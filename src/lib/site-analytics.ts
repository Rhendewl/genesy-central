import type { NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { LeadService } from "@/lib/crm/lead-service";

export const SITE_ORIGINS = new Set([
  "https://genesycompany.com",
  "https://www.genesycompany.com",
  "https://genesy-company-premium.lancastermatos.chatgpt.site",
  "http://localhost:3000",
  "http://localhost:3001",
]);

// Origens extras (ex.: endereço temporário de teste), separadas por vírgula.
const EXTRA_ORIGINS = new Set((process.env.SITE_EXTRA_ORIGINS ?? "").split(",").map(value => value.trim()).filter(Boolean));

/** Site institucional: chave padrão quando o painel não informa outra. */
export const DEFAULT_SITE_KEY = "genesycompany";

/** Chave de site/página vinda da URL do painel (?site=...). Só letras minúsculas, números e hífen. */
export function siteKeyParam(value: string | null | undefined) {
  const key = String(value ?? "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{1,47}$/.test(key) ? key : DEFAULT_SITE_KEY;
}

/** Origem gravada no CRM: o site institucional mantém "site_genesy"; cada página ganha a sua. */
export function crmSourceFor(siteKey: string) {
  return siteKey === DEFAULT_SITE_KEY ? "site_genesy" : `site_${siteKey.replace(/-/g, "_")}`;
}

export function siteCors(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  const allowed = SITE_ORIGINS.has(origin) || EXTRA_ORIGINS.has(origin) ? origin : "https://genesycompany.com";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export async function resolveSite(siteKey: string) {
  const db = createAdminSupabaseClient();
  const { data: existing } = await db
    .from("site_analytics_settings")
    .select("*")
    .eq("site_key", siteKey)
    .eq("is_active", true)
    .maybeSingle();
  if (existing) return { db, site: existing };

  // Bootstrap seguro do site institucional: o formulário publicado já define
  // o workspace proprietário, sem expor ou aceitar user_id vindo do navegador.
  const formSlug = siteKey === "genesycompany" ? "formgenesysite" : null;
  if (!formSlug) return { db, site: null };
  const { data: form } = await db.from("forms")
    .select("user_id, slug")
    .eq("slug", formSlug)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();
  if (!form) return { db, site: null };

  const { data: created } = await db.from("site_analytics_settings").upsert({
    user_id: form.user_id,
    site_key: siteKey,
    name: "Site Genesy",
    domain: "genesycompany.com",
    form_slug: form.slug,
  }, { onConflict: "user_id,site_key" }).select("*").single();
  return { db, site: created };
}

export async function syncSiteLead(leadId: string) {
  const db = createAdminSupabaseClient();
  const { data: lead } = await db.from("site_analytics_leads").select("*").eq("id", leadId).maybeSingle();
  if (!lead) return { ok: false, error: "Lead não encontrado" };
  if (lead.crm_lead_id) return { ok: true, crmLeadId: lead.crm_lead_id };

  const { data: settings } = await db.from("site_analytics_settings")
    .select("name,domain,crm_pipeline_id,crm_stage_id,assigned_to,deal_value")
    .eq("user_id", lead.user_id).eq("site_key", lead.site_key).maybeSingle();
  if (!settings?.crm_stage_id) {
    await db.from("site_analytics_leads").update({ sync_status: "disabled", sync_error: null }).eq("id", lead.id);
    return { ok: false, disabled: true, error: "Pipeline ainda não configurada" };
  }

  const notes = [
    lead.site_key === DEFAULT_SITE_KEY ? "Origem: Site Genesy" : `Origem: ${settings.name ?? lead.site_key} (${settings.domain ?? "landing page"})`,
    lead.profile ? `Perfil: ${lead.profile}` : null,
    lead.email ? `E-mail: ${lead.email}` : null,
    lead.monthly_vgv ? `Média de VGV mensal: ${lead.monthly_vgv}` : null,
  ].filter(Boolean).join("\n");
  const result = await new LeadService(db).createLead({
    user_id: lead.user_id,
    stageId: settings.crm_stage_id,
    name: lead.name,
    contact: lead.phone,
    email: lead.email ?? null,
    source: crmSourceFor(lead.site_key),
    origin_id: null,
    assigned_to: settings.assigned_to ?? null,
    tags: [],
    notes: null,
    integration_notes: notes,
    deal_value: Number(settings.deal_value ?? 0) || 0,
  });
  if (!result.ok || !result.leadId) {
    await db.from("site_analytics_leads").update({ sync_status: "failed", sync_error: result.error }).eq("id", lead.id);
    return { ok: false, error: result.error ?? "Falha ao sincronizar" };
  }
  await db.from("site_analytics_leads").update({
    crm_lead_id: result.leadId,
    crm_pipeline_id: settings.crm_pipeline_id,
    crm_stage_id: settings.crm_stage_id,
    sync_status: "synced",
    sync_error: null,
    synced_at: new Date().toISOString(),
  }).eq("id", lead.id);
  return { ok: true, crmLeadId: result.leadId };
}

