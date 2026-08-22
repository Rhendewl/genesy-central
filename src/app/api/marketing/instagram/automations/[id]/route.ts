import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { apiError, getMarketingServerContext } from "@/lib/marketing/server";
import { sanitizeInstagramAutomationInput } from "@/lib/instagram-automation/validation";

async function contextForEdit() {
  const supabase = await createServerSupabaseClient();
  const context = await getMarketingServerContext(supabase);
  if (!context.isAdmin) throw Object.assign(new Error("Apenas administradores podem editar automações"), { status: 403 });
  return { supabase, context };
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { supabase, context } = await contextForEdit();
    const input = sanitizeInstagramAutomationInput(await req.json().catch(() => ({})));
    const { data: connection } = await supabase.from("marketing_instagram_connections").select("id")
      .eq("id", input.connectionId).eq("organization_id", context.organizationId).maybeSingle();
    if (!connection) throw Object.assign(new Error("Conta do Instagram não encontrada"), { status: 404 });
    const { data, error } = await supabase.from("marketing_instagram_automations").update({
      connection_id: input.connectionId, name: input.name, status: input.status,
      trigger_type: input.triggerType, match_type: input.matchType, keywords: input.keywords,
      public_reply_text: input.publicReplyText, steps: input.steps, crm_enabled: input.crmEnabled,
      crm_pipeline_id: input.crmPipelineId, crm_stage_id: input.crmStageId, updated_at: new Date().toISOString(),
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
