import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { apiError, getMarketingServerContext } from "@/lib/marketing/server";
import { assertInstagramConnectionReady, sanitizeInstagramAutomationInput, ANY_COMMENT_ERROR } from "@/lib/instagram-automation/validation";
import { validateInstagramCrmReferences, validateInstagramFlowCrmReferences } from "@/lib/instagram-automation/crm-config";
import { flowErrors, legacyStepsToFlow, sanitizeFlow, validateFlow } from "@/lib/instagram-automation/flow";

async function contextForEdit() {
  const supabase = await createServerSupabaseClient();
  const context = await getMarketingServerContext(supabase);
  if (!context.isAdmin) throw Object.assign(new Error("Apenas administradores podem editar automações"), { status: 403 });
  return { supabase, context };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { supabase, context } = await contextForEdit();
    const body = await req.json().catch(() => ({})) as { status?: unknown };
    if (body.status !== "active" && body.status !== "paused") {
      throw Object.assign(new Error("Escolha se a automação ficará ativa ou pausada."), { status: 400 });
    }
    if (body.status === "active") {
      // The switch must apply the same checks as saving an active automation.
      const { data: current } = await supabase.from("marketing_instagram_automations")
        .select("connection_id,trigger_type,match_type,media_ids,steps,flow,crm_enabled,crm_pipeline_id,crm_stage_id")
        .eq("id", params.id).eq("organization_id", context.organizationId).maybeSingle();
      if (!current) throw Object.assign(new Error("Automação não encontrada"), { status: 404 });
      const { data: connection } = await supabase.from("marketing_instagram_connections").select("id,status,webhook_subscribed,webhook_fields,requested_scopes")
        .eq("id", current.connection_id).eq("organization_id", context.organizationId).maybeSingle();
      if (!connection) throw Object.assign(new Error("Conta do Instagram não encontrada"), { status: 404 });
      assertInstagramConnectionReady({ status: "active", triggerType: current.trigger_type } as Parameters<typeof assertInstagramConnectionReady>[0], connection);
      if (current.trigger_type === "comment" && current.match_type === "any" && !(current.media_ids ?? []).length) {
        throw Object.assign(new Error(ANY_COMMENT_ERROR), { status: 400 });
      }
      const flow = current.flow ? sanitizeFlow(current.flow) : legacyStepsToFlow({
        triggerType: current.trigger_type, steps: current.steps, crmEnabled: current.crm_enabled,
        crmPipelineId: current.crm_pipeline_id, crmStageId: current.crm_stage_id,
      });
      const [firstError] = flowErrors(validateFlow(flow, current.trigger_type));
      if (firstError) throw Object.assign(new Error(`Revise o fluxo antes de ativar: ${firstError.message}`), { status: 400 });
    }
    const { data, error } = await supabase.from("marketing_instagram_automations")
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq("id", params.id).eq("organization_id", context.organizationId).select("id,status").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw Object.assign(new Error("Automação não encontrada"), { status: 404 });
    return NextResponse.json({ automation: data });
  } catch (error) {
    const parsed = apiError(error); return NextResponse.json({ error: parsed.message }, { status: parsed.status });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { supabase, context } = await contextForEdit();
    const input = sanitizeInstagramAutomationInput(await req.json().catch(() => ({})));
    const { data: connection } = await supabase.from("marketing_instagram_connections").select("id,status,webhook_subscribed,webhook_fields,requested_scopes")
      .eq("id", input.connectionId).eq("organization_id", context.organizationId).maybeSingle();
    if (!connection) throw Object.assign(new Error("Conta do Instagram não encontrada"), { status: 404 });
    assertInstagramConnectionReady(input, connection);
    await validateInstagramCrmReferences(supabase, context.organizationId, input);
    await validateInstagramFlowCrmReferences(supabase, context.organizationId, input);
    const { data, error } = await supabase.from("marketing_instagram_automations").update({
      connection_id: input.connectionId, name: input.name, status: input.status,
      trigger_type: input.triggerType, match_type: input.matchType, keywords: input.keywords,
      public_reply_text: input.publicReplyText, steps: input.steps, crm_enabled: input.crmEnabled,
      crm_pipeline_id: input.crmPipelineId, crm_stage_id: input.crmStageId, updated_at: new Date().toISOString(),
      crm_origin_id: input.crmOriginId, crm_assigned_to: input.crmAssignedTo, crm_deal_value: input.crmDealValue,
      flow: input.flow ?? null, media_ids: input.mediaIds ?? [],
    }).eq("id", params.id).eq("organization_id", context.organizationId).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw Object.assign(new Error("Automação não encontrada"), { status: 404 });
    return NextResponse.json({ automation: data });
  } catch (error) {
    const parsed = apiError(error); return NextResponse.json({ error: parsed.message }, { status: parsed.status });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { supabase, context } = await contextForEdit();
    const { error } = await supabase.from("marketing_instagram_automations").delete()
      .eq("id", params.id).eq("organization_id", context.organizationId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (error) {
    const parsed = apiError(error); return NextResponse.json({ error: parsed.message }, { status: parsed.status });
  }
}
