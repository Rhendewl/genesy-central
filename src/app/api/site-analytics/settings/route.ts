import { NextRequest, NextResponse } from "next/server";
import { siteAnalyticsContext } from "@/lib/site-analytics-auth";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { DEFAULT_SITE_KEY, siteKeyParam } from "@/lib/site-analytics";

export async function GET(req: NextRequest) {
  const context = await siteAnalyticsContext();
  if (!context) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const siteKey = siteKeyParam(req.nextUrl.searchParams.get("site"));
  const admin = createAdminSupabaseClient();
  const [{ data: settings }, { data: pipelines }] = await Promise.all([
    admin.from("site_analytics_settings").select("*").eq("user_id", context.ownerId).eq("site_key", siteKey).maybeSingle(),
    admin.from("crm_pipelines").select("id,name,is_active,crm_stages(id,name,order_index,is_active)").eq("user_id", context.ownerId).eq("is_active", true).order("created_at"),
  ]);
  // O token da API de Conversões nunca sai do servidor: só informamos se existe.
  const safe = settings ? (({ meta_capi_token_encrypted, ...rest }) => ({ ...rest, has_capi_token: Boolean(meta_capi_token_encrypted) }))(settings) : null;
  return NextResponse.json({ settings: safe, pipelines: pipelines ?? [], canManage: context.canManage });
}

export async function PUT(req: NextRequest) {
  const context = await siteAnalyticsContext();
  if (!context) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!context.canManage) return NextResponse.json({ error: "Apenas administradores podem alterar a integração" }, { status: 403 });
  const body = await req.json().catch(() => null) as { pipeline_id?: string | null; stage_id?: string | null; assigned_to?: string | null; deal_value?: number | string | null } | null;
  const dealValue = Number(String(body?.deal_value ?? 0).replace(",", "."));
  if (!Number.isFinite(dealValue) || dealValue < 0) return NextResponse.json({ error: "Valor do negócio inválido" }, { status: 400 });
  const siteKey = siteKeyParam(req.nextUrl.searchParams.get("site"));
  const admin = createAdminSupabaseClient();
  if (body?.stage_id) {
    const { data: stage } = await admin.from("crm_stages").select("id,pipeline_id,crm_pipelines!inner(user_id)")
      .eq("id", body.stage_id).eq("pipeline_id", body.pipeline_id).eq("crm_pipelines.user_id", context.ownerId).maybeSingle();
    if (!stage) return NextResponse.json({ error: "Etapa ou pipeline inválida" }, { status: 400 });
  }
  const crm = {
    crm_pipeline_id: body?.pipeline_id ?? null, crm_stage_id: body?.stage_id ?? null,
    assigned_to: body?.assigned_to ?? null, deal_value: Math.round(dealValue * 100) / 100,
    updated_at: new Date().toISOString(),
  };
  // O site institucional pode ser criado aqui; as demais páginas são criadas pela aba "Nova página".
  const { data, error } = siteKey === DEFAULT_SITE_KEY
    ? await admin.from("site_analytics_settings").upsert({
      user_id: context.ownerId, site_key: DEFAULT_SITE_KEY, name: "Site Genesy", domain: "genesycompany.com",
      form_slug: "formgenesysite", ...crm,
    }, { onConflict: "user_id,site_key" }).select("id").single()
    : await admin.from("site_analytics_settings").update(crm)
      .eq("user_id", context.ownerId).eq("site_key", siteKey).select("id").maybeSingle();
  if (!error && !data) return NextResponse.json({ error: "Página não encontrada" }, { status: 404 });
  return NextResponse.json(error ? { error: error.message } : { ok: true, id: data?.id }, { status: error ? 500 : 200 });
}

