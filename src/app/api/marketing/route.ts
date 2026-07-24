import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { apiError, assertWorkspaceTaskVisible, createWorkspaceTaskForMarketing, getMarketingServerContext, syncMarketingTags } from "@/lib/marketing/server";
import { parseMarketingContentInput, parseMarketingIdeaInput } from "@/lib/marketing/domain";
import type { MarketingAsset, MarketingContent, MarketingIdea } from "@/types/marketing";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  try {
    const context = await getMarketingServerContext(supabase);
    const [contentsRes, ideasRes, assetsRes, membersRes, tagsRes] = await Promise.all([
      supabase.from("marketing_contents").select("*").is("archived_at", null).order("scheduled_at", { ascending: true, nullsFirst: false }),
      supabase.from("marketing_ideas").select("*").is("archived_at", null).order("created_at", { ascending: false }),
      supabase.from("marketing_assets").select("*").is("archived_at", null).order("created_at", { ascending: false }),
      supabase.from("user_profiles").select("id,auth_user_id,full_name,avatar_url,role").eq("owner_id", context.organizationId).eq("is_active", true).order("full_name"),
      supabase.from("marketing_tags").select("id,name"),
    ]);
    for (const result of [contentsRes, ideasRes, assetsRes, membersRes, tagsRes]) if (result.error) throw new Error(result.error.message);
    const contentIds = (contentsRes.data ?? []).map((row) => row.id);
    const ideaIds = (ideasRes.data ?? []).map((row) => row.id);
    const assetIds = (assetsRes.data ?? []).map((row) => row.id);
    const [assigneesRes, contentAssetsRes, checklistRes, commentsRes, usageRes, contentTagsRes, ideaTagsRes] = await Promise.all([
      contentIds.length ? supabase.from("marketing_content_assignees").select("content_id,profile_id").in("content_id", contentIds) : Promise.resolve({ data: [], error: null }),
      contentIds.length ? supabase.from("marketing_content_assets").select("content_id,asset_id").in("content_id", contentIds) : Promise.resolve({ data: [], error: null }),
      contentIds.length ? supabase.from("marketing_content_checklist_items").select("*").in("content_id", contentIds).order("position") : Promise.resolve({ data: [], error: null }),
      contentIds.length ? supabase.from("marketing_content_comments").select("*").in("content_id", contentIds).order("created_at") : Promise.resolve({ data: [], error: null }),
      assetIds.length ? supabase.from("marketing_content_assets").select("asset_id").in("asset_id", assetIds) : Promise.resolve({ data: [], error: null }),
      contentIds.length ? supabase.from("marketing_content_tags").select("content_id,tag_id").in("content_id", contentIds) : Promise.resolve({ data: [], error: null }),
      ideaIds.length ? supabase.from("marketing_idea_tags").select("idea_id,tag_id").in("idea_id", ideaIds) : Promise.resolve({ data: [], error: null }),
    ]);
    for (const result of [assigneesRes, contentAssetsRes, checklistRes, commentsRes, usageRes, contentTagsRes, ideaTagsRes]) if (result.error) throw new Error(result.error.message);
    const assigneesByContent = new Map<string, string[]>();
    for (const row of assigneesRes.data ?? []) assigneesByContent.set(row.content_id, [...(assigneesByContent.get(row.content_id) ?? []), row.profile_id]);
    const assetsByContent = new Map<string, string[]>();
    for (const row of contentAssetsRes.data ?? []) assetsByContent.set(row.content_id, [...(assetsByContent.get(row.content_id) ?? []), row.asset_id]);
    const checklistByContent = new Map<string, unknown[]>();
    for (const row of checklistRes.data ?? []) checklistByContent.set(row.content_id, [...(checklistByContent.get(row.content_id) ?? []), row]);
    const commentsByContent = new Map<string, unknown[]>();
    for (const row of commentsRes.data ?? []) commentsByContent.set(row.content_id, [...(commentsByContent.get(row.content_id) ?? []), row]);
    const usage = new Map<string, number>(); for (const row of usageRes.data ?? []) usage.set(row.asset_id, (usage.get(row.asset_id) ?? 0) + 1);
    const tagNameById = new Map((tagsRes.data ?? []).map((tag) => [tag.id, tag.name])); const contentTagNames = new Map<string,string[]>(); for (const row of contentTagsRes.data ?? []) contentTagNames.set(row.content_id,[...(contentTagNames.get(row.content_id)??[]),tagNameById.get(row.tag_id)!].filter(Boolean)); const ideaTagNames = new Map<string,string[]>(); for (const row of ideaTagsRes.data ?? []) ideaTagNames.set(row.idea_id,[...(ideaTagNames.get(row.idea_id)??[]),tagNameById.get(row.tag_id)!].filter(Boolean));
    const contents = (contentsRes.data ?? []).map((row) => { const assigneeIds = assigneesByContent.get(row.id) ?? []; const canEdit = context.isAdmin || row.created_by === context.user.id || (!!context.profileId && assigneeIds.includes(context.profileId)); return { ...row, assignee_ids: assigneeIds, asset_ids: assetsByContent.get(row.id) ?? [], tag_names: contentTagNames.get(row.id) ?? [], checklist: checklistByContent.get(row.id) ?? [], comments: commentsByContent.get(row.id) ?? [], can_edit: canEdit, can_delete: context.isAdmin } as MarketingContent; });
    const ideas = (ideasRes.data ?? []).map((row) => ({ ...row, tag_names: ideaTagNames.get(row.id) ?? [], can_edit: context.isAdmin || row.created_by === context.user.id, can_delete: context.isAdmin })) as MarketingIdea[];
    const assets = (assetsRes.data ?? []).map((row) => ({ ...row, can_manage: context.isAdmin, usage_count: usage.get(row.id) ?? 0 })) as MarketingAsset[];
    return NextResponse.json({ contents, ideas, assets, members: membersRes.data ?? [], is_admin: context.isAdmin });
  } catch (error) { const parsed = apiError(error); return NextResponse.json({ error: parsed.message }, { status: parsed.status }); }
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  try {
    const context = await getMarketingServerContext(supabase);
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (body?.resource === "contents") {
      const input = parseMarketingContentInput(body);
      const { assignee_ids = [], asset_ids = [], tag_names = [], create_workspace_task = false, ...record } = input;
      const finalAssignees = Array.from(new Set([...(assignee_ids ?? []), ...(record.primary_assignee_id ? [record.primary_assignee_id] : [])]));
      let automaticTaskId: string | null = null;
      if (create_workspace_task) {
        automaticTaskId = await createWorkspaceTaskForMarketing(supabase, context, {
          title: record.title,
          description: record.description,
          priority: record.priority ?? "medium",
          scheduledAt: record.delivery_at,
          assigneeIds: finalAssignees,
          tagIds: record.workspace_tag_ids,
        });
        record.workspace_task_id = automaticTaskId;
      } else {
        await assertWorkspaceTaskVisible(supabase, record.workspace_task_id);
      }
      const { data, error } = await supabase.from("marketing_contents").insert({ ...record, organization_id: context.organizationId, created_by: context.user.id, updated_by: context.user.id }).select("*").single();
      if (error) {
        if (automaticTaskId) await supabase.from("workspace_tasks").delete().eq("id", automaticTaskId);
        throw new Error(error.message);
      }
      if (finalAssignees.length) { const result = await supabase.from("marketing_content_assignees").insert(finalAssignees.map((profile_id) => ({ content_id: data.id, profile_id, organization_id: context.organizationId, created_by: context.user.id }))); if (result.error) throw new Error(result.error.message); }
      if (asset_ids?.length) { const result = await supabase.from("marketing_content_assets").insert(asset_ids.map((asset_id) => ({ content_id: data.id, asset_id, organization_id: context.organizationId, created_by: context.user.id }))); if (result.error) throw new Error(result.error.message); }
      await syncMarketingTags(supabase, context, "content", data.id, tag_names);
      return NextResponse.json({ content: data }, { status: 201 });
    }
    if (body?.resource === "ideas") {
      const input = parseMarketingIdeaInput(body); const { tag_names = [], ...record } = input; const { data, error } = await supabase.from("marketing_ideas").insert({ ...record, organization_id: context.organizationId, created_by: context.user.id, updated_by: context.user.id }).select("*").single(); if (error) throw new Error(error.message); await syncMarketingTags(supabase, context, "idea", data.id, tag_names); return NextResponse.json({ idea: data }, { status: 201 });
    }
    if (body?.resource === "assets") {
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 220) : ""; const storagePath = typeof body.storage_path === "string" ? body.storage_path : "";
      if (!name || !storagePath.startsWith(`marketing/${context.organizationId}/`)) throw Object.assign(new Error("Asset inválido"), { status: 400 });
      const { data, error } = await supabase.from("marketing_assets").insert({ organization_id: context.organizationId, created_by: context.user.id, updated_by: context.user.id, name, category: body.category ?? "other", mime_type: body.mime_type, file_size: body.file_size, storage_path: storagePath, public_url: body.public_url, tags: Array.isArray(body.tags) ? body.tags : [] }).select("*").single(); if (error) throw new Error(error.message); return NextResponse.json({ asset: data }, { status: 201 });
    }
    if (body?.resource === "comments") {
      const contentId = typeof body.content_id === "string" ? body.content_id : ""; const commentBody = typeof body.body === "string" ? body.body.trim().slice(0, 4000) : "";
      if (!contentId || !commentBody) throw Object.assign(new Error("Comentário inválido"), { status: 400 });
      const { data, error } = await supabase.from("marketing_content_comments").insert({ content_id: contentId, organization_id: context.organizationId, body: commentBody, author_profile_id: context.profileId, created_by: context.user.id }).select("*").single(); if (error) throw new Error(error.message); return NextResponse.json({ comment: data }, { status: 201 });
    }
    if (body?.resource === "checklist") {
      const contentId = typeof body.content_id === "string" ? body.content_id : ""; const label = typeof body.label === "string" ? body.label.trim().slice(0, 240) : "";
      if (!contentId || !label) throw Object.assign(new Error("Item inválido"), { status: 400 });
      const { count } = await supabase.from("marketing_content_checklist_items").select("id", { count: "exact", head: true }).eq("content_id", contentId);
      const { data, error } = await supabase.from("marketing_content_checklist_items").insert({ content_id: contentId, organization_id: context.organizationId, label, position: (count ?? 0) * 10, created_by: context.user.id }).select("*").single(); if (error) throw new Error(error.message); return NextResponse.json({ item: data }, { status: 201 });
    }
    throw Object.assign(new Error("Recurso inválido"), { status: 400 });
  } catch (error) { const parsed = apiError(error); return NextResponse.json({ error: parsed.message }, { status: parsed.status }); }
}
