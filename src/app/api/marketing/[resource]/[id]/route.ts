import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { apiError, assertWorkspaceTaskVisible, createWorkspaceTaskForMarketing, getMarketingServerContext, syncMarketingTags } from "@/lib/marketing/server";
import { parseMarketingContentInput, parseMarketingIdeaInput } from "@/lib/marketing/domain";
type Params = { params: Promise<{ resource: string; id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { resource, id } = await params; const supabase = await createServerSupabaseClient();
  try {
    const context = await getMarketingServerContext(supabase); const body = await req.json().catch(() => null);
    if (resource === "contents") {
      const input = parseMarketingContentInput(body);
      const { assignee_ids = [], asset_ids = [], tag_names = [], create_workspace_task = false, ...record } = input;
      const { data: currentContent, error: currentContentError } = await supabase.from("marketing_contents").select("workspace_task_id").eq("id", id).single();
      if (currentContentError) throw new Error(currentContentError.message);
      const finalAssignees = Array.from(new Set([...(assignee_ids ?? []), ...(record.primary_assignee_id ? [record.primary_assignee_id] : [])]));
      let automaticTaskId: string | null = null;
      if (create_workspace_task) {
        if (currentContent.workspace_task_id) throw Object.assign(new Error("Este conteúdo já possui uma tarefa vinculada"), { status: 400 });
        automaticTaskId = await createWorkspaceTaskForMarketing(supabase, context, {
          title: record.title,
          description: record.description,
          priority: record.priority ?? "medium",
          scheduledAt: record.delivery_at,
          assigneeIds: finalAssignees,
          tagIds: record.workspace_tag_ids,
        });
        record.workspace_task_id = automaticTaskId;
      } else if (record.workspace_task_id !== currentContent.workspace_task_id) {
        await assertWorkspaceTaskVisible(supabase, record.workspace_task_id);
      }
      const { data, error } = await supabase.from("marketing_contents").update({ ...record, updated_by: context.user.id }).eq("id", id).select("*").single();
      if (error) {
        if (automaticTaskId) await supabase.from("workspace_tasks").delete().eq("id", automaticTaskId);
        throw new Error(error.message);
      }
      const deletedAssignees = await supabase.from("marketing_content_assignees").delete().eq("content_id", id); if (deletedAssignees.error) throw new Error(deletedAssignees.error.message);
      if (finalAssignees.length) { const result = await supabase.from("marketing_content_assignees").insert(finalAssignees.map((profile_id) => ({ content_id: id, profile_id, organization_id: context.organizationId, created_by: context.user.id }))); if (result.error) throw new Error(result.error.message); }
      const deletedAssets = await supabase.from("marketing_content_assets").delete().eq("content_id", id); if (deletedAssets.error) throw new Error(deletedAssets.error.message);
      if (asset_ids?.length) { const result = await supabase.from("marketing_content_assets").insert(asset_ids.map((asset_id) => ({ content_id: id, asset_id, organization_id: context.organizationId, created_by: context.user.id }))); if (result.error) throw new Error(result.error.message); }
      await syncMarketingTags(supabase, context, "content", id, tag_names);
      return NextResponse.json({ content: data });
    }
    if (resource === "ideas") { const input = parseMarketingIdeaInput(body); const { tag_names = [], ...record } = input; const { data, error } = await supabase.from("marketing_ideas").update({ ...record, updated_by: context.user.id }).eq("id", id).select("*").single(); if (error) throw new Error(error.message); await syncMarketingTags(supabase, context, "idea", id, tag_names); return NextResponse.json({ idea: data }); }
    if (resource === "assets") { if (!context.isAdmin) throw Object.assign(new Error("Somente administradores podem alterar assets"), { status: 403 }); const value = body as Record<string, unknown>; const { data, error } = await supabase.from("marketing_assets").update({ name: typeof value.name === "string" ? value.name.trim().slice(0, 220) : undefined, category: value.category, tags: Array.isArray(value.tags) ? value.tags : undefined, updated_by: context.user.id }).eq("id", id).select("*").single(); if (error) throw new Error(error.message); return NextResponse.json({ asset: data }); }
    if (resource === "checklist") { const value = body as Record<string, unknown>; const patch = { ...(typeof value.label === "string" ? { label: value.label.trim().slice(0, 240) } : {}), ...(typeof value.is_completed === "boolean" ? { is_completed: value.is_completed } : {}) }; const { data, error } = await supabase.from("marketing_content_checklist_items").update(patch).eq("id", id).select("*").single(); if (error) throw new Error(error.message); return NextResponse.json({ item: data }); }
    throw Object.assign(new Error("Recurso inválido"), { status: 400 });
  } catch (error) { const parsed = apiError(error); return NextResponse.json({ error: parsed.message }, { status: parsed.status }); }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { resource, id } = await params; const supabase = await createServerSupabaseClient();
  try { const context = await getMarketingServerContext(supabase); if (resource === "checklist") { const { error } = await supabase.from("marketing_content_checklist_items").delete().eq("id", id); if (error) throw new Error(error.message); return NextResponse.json({ ok: true }); } if (!context.isAdmin) throw Object.assign(new Error("Somente administradores podem arquivar registros"), { status: 403 }); const table = resource === "contents" ? "marketing_contents" : resource === "ideas" ? "marketing_ideas" : resource === "assets" ? "marketing_assets" : null; if (!table) throw Object.assign(new Error("Recurso inválido"), { status: 400 }); const { error } = await supabase.from(table).update({ archived_at: new Date().toISOString(), updated_by: context.user.id }).eq("id", id); if (error) throw new Error(error.message); return NextResponse.json({ ok: true }); }
  catch (error) { const parsed = apiError(error); return NextResponse.json({ error: parsed.message }, { status: parsed.status }); }
}
