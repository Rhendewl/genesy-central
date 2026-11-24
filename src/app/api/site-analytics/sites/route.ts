import { NextRequest, NextResponse } from "next/server";
import { siteAnalyticsContext } from "@/lib/site-analytics-auth";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { DEFAULT_SITE_KEY } from "@/lib/site-analytics";

// Sites e landing pages do módulo Site Genesy: cada um vira uma aba no painel.
export async function GET() {
  const context = await siteAnalyticsContext();
  if (!context) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.from("site_analytics_settings")
    .select("site_key,name,domain,is_active,sort_order,created_at")
    .eq("user_id", context.ownerId)
    .order("sort_order").order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const sites = data ?? [];
  // O site institucional sempre aparece, mesmo antes do primeiro acesso.
  if (!sites.some(site => site.site_key === DEFAULT_SITE_KEY)) {
    sites.unshift({ site_key: DEFAULT_SITE_KEY, name: "Site Genesy", domain: "genesycompany.com", is_active: true, sort_order: 0, created_at: new Date(0).toISOString() });
  }
  return NextResponse.json({ sites, canManage: context.canManage });
}

// Edita o endereço ou ativa/desativa uma página. O site institucional não pode ser desativado.
export async function PATCH(req: NextRequest) {
  const context = await siteAnalyticsContext();
  if (!context) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!context.canManage) return NextResponse.json({ error: "Apenas administradores podem alterar páginas" }, { status: 403 });
  const body = await req.json().catch(() => null) as { site_key?: string; domain?: string; is_active?: boolean } | null;
  const siteKey = (body?.site_key ?? "").trim().toLowerCase();
  if (!siteKey) return NextResponse.json({ error: "Página não informada" }, { status: 400 });
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body?.domain === "string") {
    const domain = body.domain.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "").slice(0, 200);
    if (!domain || /\s/.test(domain) || !domain.includes(".")) return NextResponse.json({ error: "Endereço inválido" }, { status: 400 });
    update.domain = domain;
  }
  if (typeof body?.is_active === "boolean") {
    if (siteKey === DEFAULT_SITE_KEY && !body.is_active) return NextResponse.json({ error: "O site institucional não pode ser desativado" }, { status: 400 });
    update.is_active = body.is_active;
  }
  if (Object.keys(update).length === 1) return NextResponse.json({ error: "Nada para alterar" }, { status: 400 });
  const admin = createAdminSupabaseClient();
  if (typeof update.domain === "string") {
    // O domínio é fixo: só o caminho depois da "/" pode mudar.
    const { data: existing } = await admin.from("site_analytics_settings").select("domain").eq("user_id", context.ownerId).eq("site_key", siteKey).maybeSingle();
    const hostOf = (value: string) => value.replace(/^https?:\/\//, "").split("/")[0].toLowerCase();
    if (existing && hostOf(existing.domain) !== hostOf(update.domain)) return NextResponse.json({ error: "O domínio é fixo; altere só o caminho depois da /" }, { status: 400 });
  }
  const { data, error } = await admin.from("site_analytics_settings").update(update)
    .eq("user_id", context.ownerId).eq("site_key", siteKey).select("site_key,name,domain,is_active").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Página não encontrada" }, { status: 404 });
  return NextResponse.json({ ok: true, site: data });
}

// Cria uma nova página. Começa com a mesma pipeline e o mesmo Pixel do site institucional,
// que podem ser trocados na aba da página.
export async function POST(req: NextRequest) {
  const context = await siteAnalyticsContext();
  if (!context) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!context.canManage) return NextResponse.json({ error: "Apenas administradores podem criar páginas" }, { status: 403 });
  const body = await req.json().catch(() => null) as { name?: string; site_key?: string; domain?: string } | null;
  const name = body?.name?.trim().slice(0, 80) ?? "";
  const siteKey = (body?.site_key ?? "").trim().toLowerCase();
  const domain = (body?.domain ?? "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "").slice(0, 200);
  if (name.length < 2) return NextResponse.json({ error: "Dê um nome para a página" }, { status: 400 });
  if (!/^[a-z0-9][a-z0-9-]{1,47}$/.test(siteKey)) return NextResponse.json({ error: "Identificador inválido: use letras minúsculas, números e hífen" }, { status: 400 });
  if (!domain) return NextResponse.json({ error: "Informe o endereço da página" }, { status: 400 });

  const admin = createAdminSupabaseClient();
  const { data: exists } = await admin.from("site_analytics_settings").select("id").eq("site_key", siteKey).maybeSingle();
  if (exists) return NextResponse.json({ error: "Já existe uma página com esse identificador" }, { status: 409 });
  const { data: base } = await admin.from("site_analytics_settings")
    .select("crm_pipeline_id,crm_stage_id,assigned_to,deal_value,meta_pixel_enabled,meta_pixel_id,meta_capi_token_encrypted")
    .eq("user_id", context.ownerId).eq("site_key", DEFAULT_SITE_KEY).maybeSingle();
  const { count } = await admin.from("site_analytics_settings").select("id", { count: "exact", head: true }).eq("user_id", context.ownerId);
  const { error } = await admin.from("site_analytics_settings").insert({
    user_id: context.ownerId, site_key: siteKey, name, domain, sort_order: (count ?? 0) * 10,
    crm_pipeline_id: base?.crm_pipeline_id ?? null, crm_stage_id: base?.crm_stage_id ?? null,
    assigned_to: base?.assigned_to ?? null, deal_value: base?.deal_value ?? 0,
    meta_pixel_enabled: base?.meta_pixel_enabled ?? false, meta_pixel_id: base?.meta_pixel_id ?? null,
    meta_capi_token_encrypted: base?.meta_capi_token_encrypted ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, site_key: siteKey }, { status: 201 });
}
