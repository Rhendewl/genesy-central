import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getMarketingServerContext, apiError } from "@/lib/marketing/server";
import { decryptToken } from "@/lib/crypto";
import { getLeadGenForms } from "@/lib/meta-api";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const db = await createServerSupabaseClient();
    const context = await getMarketingServerContext(db);
    if (!context.isAdmin) throw Object.assign(new Error("Apenas administradores podem configurar a captura."), { status: 403 });
    const body = await req.json();
    const { pageId, formId, active, assignedTo, dealValue } = body;
    // Destino dos leads: etapa fixa de um CRM ("stage") ou roleta de distribuição entre pipelines ("roulette").
    const mode: "stage" | "roulette" = body.mode === "roulette" ? "roulette" : "stage";
    const pipelineId = mode === "roulette" ? null : body.pipelineId;
    const stageId = mode === "roulette" ? null : body.stageId;
    const rouletteId: string | null = typeof body.rouletteId === "string" && /^[0-9a-f-]{36}$/i.test(body.rouletteId) ? body.rouletteId : null;
    if (mode === "roulette" && !rouletteId) throw Object.assign(new Error("Escolha a fila de distribuição."), { status: 400 });
    if (dealValue !== undefined && (typeof dealValue !== "number" || !Number.isFinite(dealValue) || dealValue < 0 || dealValue > 999_999_999_999.99)) {
      throw Object.assign(new Error("Informe um valor de negócio válido, maior ou igual a zero."), { status: 400 });
    }
    if (![pageId, formId].every((id) => typeof id === "string" && /^\d+$/.test(id)) || typeof active !== "boolean") throw Object.assign(new Error("Página ou formulário inválido."), { status: 400 });
    if (mode === "stage" && active && (!pipelineId || !stageId)) throw Object.assign(new Error("Escolha o CRM e a etapa de entrada."), { status: 400 });
    const page = await db.from("meta_page_subscriptions").select("encrypted_page_token,is_active").eq("user_id", context.user.id).eq("meta_page_id", pageId).maybeSingle();
    if (page.error || !page.data) throw Object.assign(new Error("Página não encontrada."), { status: 404 });
    if (active && !page.data.is_active) throw Object.assign(new Error("Sincronize e ative esta página antes de capturar."), { status: 400 });
    if (pipelineId || stageId) {
      const stage = await db.from("crm_stages").select("id,crm_pipelines!inner(user_id,is_active)").eq("id", stageId)
        .eq("pipeline_id", pipelineId).eq("is_active", true).eq("crm_pipelines.user_id", context.user.id).eq("crm_pipelines.is_active", true).maybeSingle();
      if (stage.error || !stage.data) throw Object.assign(new Error("CRM ou etapa inválida."), { status: 400 });
    }
    if (assignedTo) {
      const assignee = await db.from("user_profiles").select("id,auth_user_id").eq("id", assignedTo).eq("owner_id", context.user.id).eq("is_active", true).maybeSingle();
      if (assignee.error || !assignee.data?.auth_user_id) throw Object.assign(new Error("Responsável indisponível nesta conta."), { status: 400 });
    }
    // A new active binding must be verified against the page's own forms.
    let formName: string | null = null;
    if (active) {
      if (!page.data.encrypted_page_token) throw Object.assign(new Error("Sincronize as páginas antes de ativar."), { status: 400 });
      const forms = await getLeadGenForms(pageId, decryptToken(page.data.encrypted_page_token));
      const form = forms.find((item) => item.id === formId);
      if (!form) throw Object.assign(new Error("O formulário não pertence a esta página."), { status: 400 });
      formName = form.name;
    } else {
      const current = await db.from("meta_form_subscriptions").select("form_name").eq("user_id", context.user.id).eq("page_id", pageId).eq("form_id", formId).maybeSingle();
      if (current.data) formName = current.data.form_name;
      else {
        if (!page.data.encrypted_page_token) throw Object.assign(new Error("Sincronize as páginas antes de configurar."), { status: 400 });
        const forms = await getLeadGenForms(pageId, decryptToken(page.data.encrypted_page_token));
        const form = forms.find((item) => item.id === formId);
        if (!form) throw Object.assign(new Error("O formulário não pertence a esta página."), { status: 400 });
        formName = form.name;
      }
    }
    const previous = await db.from("meta_form_subscriptions").select("assigned_to,form_name,is_active,crm_pipeline_id,crm_stage_id")
      .eq("user_id", context.user.id).eq("page_id", pageId).eq("form_id", formId).maybeSingle();
    const saved = await db.from("meta_form_subscriptions").upsert({ user_id: context.user.id, page_id: pageId, form_id: formId,
      assigned_to: assignedTo || null, form_name: formName, is_active: active, crm_pipeline_id: pipelineId || null, crm_stage_id: stageId || null,
      ...(dealValue !== undefined ? { crm_deal_value: Math.round(dealValue * 100) / 100 } : {}),
      updated_at: new Date().toISOString() }, { onConflict: "user_id,form_id" });
    if (saved.error) throw new Error(saved.error.message);

    // Liga o formulário à fila escolhida (roleta) ou tira de qualquer fila (etapa fixa).
    const currentLink = mode === "stage"
      ? await db.from("crm_roulette_forms").select("roulette_id").eq("user_id", context.user.id).eq("source_kind", "meta").eq("form_id", formId).eq("page_id", pageId).maybeSingle()
      : { data: null };
    const linked = mode === "roulette" || currentLink.data
      ? await db.rpc("crm_roulette_set_form", { p_roulette: mode === "roulette" ? rouletteId : null, p_source: "meta", p_form: formId, p_page: pageId })
      : { error: null };
    if (linked.error) {
      if (mode === "roulette") {
        // Desfaz a configuração do formulário para não deixá-lo sem destino.
        if (previous.data) await db.from("meta_form_subscriptions").update(previous.data).eq("user_id", context.user.id).eq("page_id", pageId).eq("form_id", formId);
        else await db.from("meta_form_subscriptions").delete().eq("user_id", context.user.id).eq("page_id", pageId).eq("form_id", formId);
      }
      throw Object.assign(new Error(linked.error.message), { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) { const e = apiError(error); return NextResponse.json({ error: e.message }, { status: e.status }); }
}
