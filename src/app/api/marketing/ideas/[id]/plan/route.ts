import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { apiError, assertWorkspaceTaskVisible, createWorkspaceTaskForMarketing, getMarketingServerContext, syncMarketingTags } from "@/lib/marketing/server";
import { parseMarketingContentInput } from "@/lib/marketing/domain";

type Params = { params: Promise<{ id: string }> };
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params; const supabase = await createServerSupabaseClient();
  try {
    const context = await getMarketingServerContext(supabase);
    const { data: idea, error: ideaError } = await supabase.from("marketing_ideas").select("*").eq("id", id).single();
    if (ideaError) throw new Error(ideaError.message);
    const body = await req.json().catch(() => ({}));
    const input = parseMarketingContentInput({ title: idea.title, description: idea.description, platform: idea.suggested_platform, format: idea.suggested_format, primary_assignee_id: idea.suggested_assignee_id, priority: idea.priority, ...(body as object) });
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
    const { data: content, error } = await supabase.from("marketing_contents").insert({ ...record, origin_idea_id: id, organization_id: context.organizationId, created_by: context.user.id, updated_by: context.user.id }).select("*").single();
    if (error) {
      if (automaticTaskId) await supabase.from("workspace_tasks").delete().eq("id", automaticTaskId);
      throw new Error(error.message);
    }
    if (finalAssignees.length) { const result = await supabase.from("marketing_content_assignees").insert(finalAssignees.map((profile_id) => ({ content_id: content.id, profile_id, organization_id: context.organizationId, created_by: context.user.id }))); if (result.error) throw new Error(result.error.message); }
    if (asset_ids?.length) { const result = await supabase.from("marketing_content_assets").insert(asset_ids.map((asset_id) => ({ content_id: content.id, asset_id, organization_id: context.organizationId, created_by: context.user.id }))); if (result.error) throw new Error(result.error.message); }
    await syncMarketingTags(supabase, context, "content", content.id, tag_names);
    const updateIdea = await supabase.from("marketing_ideas").update({ status: "converted", updated_by: context.user.id }).eq("id", id);
    if (updateIdea.error) throw new Error(updateIdea.error.message);
    return NextResponse.json({ content }, { status: 201 });
  } catch (error) { const parsed = apiError(error); return NextResponse.json({ error: parsed.message }, { status: parsed.status }); }
}
