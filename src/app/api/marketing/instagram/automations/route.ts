import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { apiError, getMarketingServerContext } from "@/lib/marketing/server";
import { sanitizeInstagramAutomationInput } from "@/lib/instagram-automation/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  try {
    const context = await getMarketingServerContext(supabase);
    const [{ data: automations, error }, { data: connections }, { data: pipelines }] = await Promise.all([
      supabase.from("marketing_instagram_automations").select("*").eq("organization_id", context.organizationId).order("created_at", { ascending: false }),
      supabase.from("marketing_instagram_connections").select("id,username,status,webhook_subscribed,webhook_fields,webhook_error,requested_scopes").eq("organization_id", context.organizationId).order("username"),
      supabase.from("crm_pipelines").select("id,name,crm_stages(id,name,is_active,order_index)").eq("user_id", context.organizationId).eq("is_active", true).order("order_index"),
    ]);
    if (error) throw new Error(error.message);
    const enriched = (automations ?? []).map(automation => ({ ...automation, metrics: {
      triggers: Number(automation.trigger_count ?? 0),
      completed: Number(automation.completed_run_count ?? 0),
      failed: Number(automation.failed_run_count ?? 0),
      messagesSent: Number(automation.action_count ?? 0),
    } }));
    return NextResponse.json({ automations: enriched, connections: connections ?? [], pipelines: pipelines ?? [], is_admin: context.isAdmin });
  } catch (error) {
    const parsed = apiError(error); return NextResponse.json({ error: parsed.message }, { status: parsed.status });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  try {
    const context = await getMarketingServerContext(supabase);
    if (!context.isAdmin) throw Object.assign(new Error("Apenas administradores podem criar automações"), { status: 403 });
    const input = sanitizeInstagramAutomationInput(await req.json().catch(() => ({})));
    const { data: connection } = await supabase.from("marketing_instagram_connections").select("id")
      .eq("id", input.connectionId).eq("organization_id", context.organizationId).maybeSingle();
    if (!connection) throw Object.assign(new Error("Conta do Instagram não encontrada"), { status: 404 });
    const { data, error } = await supabase.from("marketing_instagram_automations").insert({
      organization_id: context.organizationId, connection_id: input.connectionId, created_by: context.user.id,
      name: input.name, status: input.status, trigger_type: input.triggerType, match_type: input.matchType,
      keywords: input.keywords, public_reply_text: input.publicReplyText, steps: input.steps,
      crm_enabled: input.crmEnabled, crm_pipeline_id: input.crmPipelineId, crm_stage_id: input.crmStageId,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ automation: data }, { status: 201 });
  } catch (error) {
    const parsed = apiError(error); return NextResponse.json({ error: parsed.message }, { status: parsed.status });
  }
}
