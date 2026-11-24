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
    .eq("user_id", context.ownerId).eq("is_active", true)
    .order("sort_order").order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const sites = data ?? [];
  // O site institucional sempre aparece, mesmo antes do primeiro acesso.
  if (!sites.some(site => site.site_key === DEFAULT_SITE_KEY)) {
    sites.unshift({ site_key: DEFAULT_SITE_KEY, name: "Site Genesy", domain: "genesycompany.com", is_active: true, sort_order: 0, created_at: new Date(0).toISOString() });
  }
  return NextResponse.json({ sites, canManage: context.canManage });
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
