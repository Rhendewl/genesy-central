import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { apiError, getMarketingServerContext } from "@/lib/marketing/server";
import { assertInstagramConnectionReady, sanitizeInstagramAutomationInput } from "@/lib/instagram-automation/validation";
import { validateInstagramCrmReferences, validateInstagramFlowCrmReferences } from "@/lib/instagram-automation/crm-config";
import {
  assertCanManageInstagramConnection, assertInstagramCrmAllowed, assertMarketingAccess, canConnectInstagramAccounts,
  canUseInstagramCrm, scopeByConnectionIds, scopeInstagramConnections, visibleInstagramConnectionIds,
} from "@/lib/marketing/instagram-access";
import { canAccess } from "@/lib/module-permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  try {
    const context = await getMarketingServerContext(supabase);
    assertMarketingAccess(context, "marketing.instagram");
    const visibleIds = await visibleInstagramConnectionIds(supabase, context);
    const canUseCrm = canUseInstagramCrm(context);
    const empty = Promise.resolve({ data: [], error: null });
    const [{ data: automations, error }, { data: connections }, { data: pipelines }, { data: profiles }] = await Promise.all([
      scopeByConnectionIds(supabase.from("marketing_instagram_automations").select("*").eq("organization_id", context.organizationId), visibleIds).order("created_at", { ascending: false }),
      scopeInstagramConnections(supabase.from("marketing_instagram_connections").select("id,username,status,webhook_subscribed,webhook_fields,webhook_error,requested_scopes").eq("organization_id", context.organizationId), context).order("username"),
      // Pipelines e responsáveis do CRM só para quem tem o CRM liberado.
      canUseCrm ? supabase.from("crm_pipelines").select("id,name,crm_stages(id,name,is_active,order_index)").eq("user_id", context.organizationId).eq("is_active", true).order("order_index") : empty,
      canUseCrm ? supabase.from("user_profiles").select("id,full_name,job_title,is_active").eq("owner_id", context.organizationId).eq("is_active", true).order("full_name") : empty,
    ]);
    if (error) throw new Error(error.message);
    const enriched = (automations ?? []).map(automation => ({ ...automation, metrics: {
      triggers: Number(automation.trigger_count ?? 0),
      completed: Number(automation.completed_run_count ?? 0),
      failed: Number(automation.failed_run_count ?? 0),
      messagesSent: Number(automation.action_count ?? 0),
    } }));
    return NextResponse.json({
      automations: enriched, connections: connections ?? [], pipelines: pipelines ?? [], profiles: profiles ?? [],
      is_admin: context.isAdmin,
      can_manage: canConnectInstagramAccounts(context) && canAccess(context.permissions, "marketing.instagram.automations", context.isAdmin),
      can_use_crm: canUseCrm,
    });
  } catch (error) {
    const parsed = apiError(error); return NextResponse.json({ error: parsed.message }, { status: parsed.status });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  try {
    const context = await getMarketingServerContext(supabase);
    assertMarketingAccess(context, "marketing.instagram.automations");
    if (!canConnectInstagramAccounts(context)) throw Object.assign(new Error("Apenas administradores podem criar automações"), { status: 403 });
    const input = sanitizeInstagramAutomationInput(await req.json().catch(() => ({})));
    const { data: connection } = await supabase.from("marketing_instagram_connections").select("id,status,webhook_subscribed,webhook_fields,requested_scopes,connected_by")
      .eq("id", input.connectionId).eq("organization_id", context.organizationId).maybeSingle();
    if (!connection) throw Object.assign(new Error("Conta do Instagram não encontrada"), { status: 404 });
    assertCanManageInstagramConnection(context, connection, "Você só pode criar automações nas contas que conectou");
    assertInstagramCrmAllowed(context, input);
    assertInstagramConnectionReady(input, connection);
    await validateInstagramCrmReferences(supabase, context.organizationId, input);
    await validateInstagramFlowCrmReferences(supabase, context.organizationId, input);
    const { data, error } = await supabase.from("marketing_instagram_automations").insert({
      organization_id: context.organizationId, connection_id: input.connectionId, created_by: context.user.id,
      name: input.name, status: input.status, trigger_type: input.triggerType, match_type: input.matchType,
      keywords: input.keywords, public_reply_text: input.publicReplyText, steps: input.steps,
      crm_enabled: input.crmEnabled, crm_pipeline_id: input.crmPipelineId, crm_stage_id: input.crmStageId,
      crm_origin_id: input.crmOriginId, crm_assigned_to: input.crmAssignedTo, crm_deal_value: input.crmDealValue,
      flow: input.flow ?? null, media_ids: input.mediaIds ?? [],
    }).select("*").single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ automation: data }, { status: 201 });
  } catch (error) {
    const parsed = apiError(error); return NextResponse.json({ error: parsed.message }, { status: parsed.status });
  }
}
