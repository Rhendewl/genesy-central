import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken } from "@/lib/crypto";
import { fetchMetaLead } from "@/lib/meta-leads";
import { LeadService } from "@/lib/crm/lead-service";

export type MetaLeadEvent = { page_id: string; leadgen_id: string; form_id: string; created_time?: number; ad_id?: string };
export type FormRoute = { form_id: string; form_name?: string | null; is_active: boolean; crm_pipeline_id: string | null; crm_stage_id: string | null };
export function resolveFormRoute(routes: FormRoute[], formId: string, legacyCapture = false) {
  // An explicitly paused form stays paused even when all forms are paused.
  if (!routes.length) return { capture: legacyCapture, route: null }; // Only explicitly preserved legacy page configuration.
  const route = routes.find((item) => item.form_id === formId);
  return { capture: Boolean(route?.is_active), route: route ?? null };
}

export async function captureMetaLead(db: SupabaseClient, event: MetaLeadEvent, ownerId: string) {
  const { data: page, error: pageError } = await db.from("meta_page_subscriptions")
    .select("user_id,encrypted_page_token,platform_account_id,capture_unconfigured_forms").eq("user_id", ownerId).eq("meta_page_id", event.page_id).eq("is_active", true).maybeSingle();
  if (pageError) throw new Error(pageError.message);
  if (!page) return { status: "skipped", step: "page_inactive" };
  const { data: subscriptions, error: routeError } = await db.from("meta_form_subscriptions")
    .select("form_id,form_name,is_active,crm_pipeline_id,crm_stage_id").eq("user_id", ownerId).eq("page_id", event.page_id);
  if (routeError) throw new Error(routeError.message);
  const routing = resolveFormRoute(subscriptions ?? [], event.form_id, page.capture_unconfigured_forms === true);
  if (!routing.capture) return { status: "skipped", step: "form_paused_or_unconfigured" };
  const existing = await db.from("leads").select("id").eq("user_id", ownerId).eq("leadgen_id", event.leadgen_id).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return { status: "duplicate", step: "already_captured", lead_id: existing.data.id };

  let stageId = routing.route?.crm_stage_id;
  if (stageId) {
    const stage = await db.from("crm_stages").select("id,crm_pipelines!inner(user_id,is_active)")
      .eq("id", stageId).eq("pipeline_id", routing.route!.crm_pipeline_id!).eq("is_active", true)
      .eq("crm_pipelines.user_id", ownerId).eq("crm_pipelines.is_active", true).maybeSingle();
    if (stage.error || !stage.data) throw new Error("O CRM ou a etapa configurada não está disponível. Atualize o destino deste formulário.");
  } else {
    // Preserve pre-existing captures through their legacy entry stage.
    const legacy = await db.from("crm_stages").select("id,crm_pipelines!inner(user_id,is_active)")
      .eq("crm_pipelines.user_id", ownerId).eq("crm_pipelines.is_active", true).eq("is_active", true)
      .eq("legacy_column", "novo_lead").order("order_index").limit(1).maybeSingle();
    if (legacy.error || !legacy.data) throw new Error("Escolha o CRM e a etapa de entrada em Marketing → Formulários Meta.");
    stageId = legacy.data.id;
  }
  let encrypted = page.encrypted_page_token;
  if (!encrypted && page.platform_account_id) {
    const token = await db.from("meta_tokens").select("encrypted_token").eq("user_id", ownerId)
      .eq("platform_account_id", page.platform_account_id).maybeSingle();
    encrypted = token.data?.encrypted_token;
  }
  if (!encrypted) throw new Error("Página sem autorização. Sincronize ou reconecte a conta Meta.");
  const lead = await fetchMetaLead(event.leadgen_id, decryptToken(encrypted));
  const notes = ["Formulário instantâneo Meta", `Formulário: ${routing.route?.form_name || event.form_id}`,
    ...(lead.campaign_name ? [`Campanha: ${lead.campaign_name}`] : []),
    ...(lead.ad_name ? [`Anúncio: ${lead.ad_name}`] : []), "", "Respostas do formulário",
    ...lead.custom_fields.map((field) => `${field.label}: ${field.value}`)].join("\n");
  const result = await new LeadService(db).createLead({
    user_id: ownerId, stageId: stageId!, name: lead.full_name || lead.first_name || "Lead Meta",
    contact: lead.phone || lead.email || "", email: lead.email, source: "meta_lead_ads",
    page_id: event.page_id, leadgen_id: event.leadgen_id, form_id: event.form_id,
    form_name: routing.route?.form_name ?? null, campaign_name: lead.campaign_name, ad_name: lead.ad_name,
    meta_form_answers: lead.answers, integration_notes: notes,
    entered_at: event.created_time && Number.isFinite(event.created_time) ? new Date(event.created_time * 1000).toISOString().slice(0, 10) : undefined,
  });
  if (!result.ok) {
    // A simultaneous delivery may have won the database uniqueness race.
    const concurrent = await db.from("leads").select("id").eq("user_id", ownerId).eq("leadgen_id", event.leadgen_id).maybeSingle();
    if (concurrent.data) return { status: "duplicate", step: "already_captured", lead_id: concurrent.data.id };
    throw new Error(result.error || "Não foi possível salvar o lead no CRM.");
  }
  return { status: "processed", step: "done", lead_id: result.leadId };
}

export async function processMetaLeadEvent(db: SupabaseClient, event: MetaLeadEvent, ownerId: string) {
  const { data: log, error } = await db.from("meta_webhook_logs").insert({
    user_id: ownerId, page_id: event.page_id, form_id: event.form_id, leadgen_id: event.leadgen_id,
    payload: event, status: "received", step: "received",
  }).select("id").single();
  if (error) throw new Error(error.message);
  try {
    const result = await captureMetaLead(db, event, ownerId);
    const saved = await db.from("meta_webhook_logs").update({ ...result, processed_at: new Date().toISOString() }).eq("id", log.id);
    if (saved.error) throw new Error(saved.error.message);
    return result;
  } catch (error) {
    await db.from("meta_webhook_logs").update({ status: "error", step: "capture_failed", error_message: error instanceof Error ? error.message : "Falha na captura", processed_at: new Date().toISOString() }).eq("id", log.id);
    throw error;
  }
}
