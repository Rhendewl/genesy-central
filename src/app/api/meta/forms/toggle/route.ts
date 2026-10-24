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
    const { pageId, formId, active, pipelineId, stageId, assignedTo } = body;
    if (![pageId, formId].every((id) => typeof id === "string" && /^\d+$/.test(id)) || typeof active !== "boolean") throw Object.assign(new Error("Página ou formulário inválido."), { status: 400 });
    if (active && (!pipelineId || !stageId)) throw Object.assign(new Error("Escolha o CRM e a etapa de entrada."), { status: 400 });
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
    const saved = await db.from("meta_form_subscriptions").upsert({ user_id: context.user.id, page_id: pageId, form_id: formId,
      assigned_to: assignedTo || null, form_name: formName, is_active: active, crm_pipeline_id: pipelineId || null, crm_stage_id: stageId || null,
      updated_at: new Date().toISOString() }, { onConflict: "user_id,form_id" });
    if (saved.error) throw new Error(saved.error.message);
    return NextResponse.json({ success: true });
  } catch (error) { const e = apiError(error); return NextResponse.json({ error: e.message }, { status: e.status }); }
}
