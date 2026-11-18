import { NextRequest, NextResponse } from "next/server";
import { siteAnalyticsContext } from "@/lib/site-analytics-auth";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export async function GET() {
  const context = await siteAnalyticsContext();
  if (!context) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const admin = createAdminSupabaseClient();
  const [{ data: settings }, { data: pipelines }] = await Promise.all([
    admin.from("site_analytics_settings").select("*").eq("user_id", context.ownerId).eq("site_key", "genesycompany").maybeSingle(),
    admin.from("crm_pipelines").select("id,name,is_active,crm_stages(id,name,order_index,is_active)").eq("user_id", context.ownerId).eq("is_active", true).order("created_at"),
  ]);
  return NextResponse.json({ settings, pipelines: pipelines ?? [], canManage: context.canManage });
}

export async function PUT(req: NextRequest) {
  const context = await siteAnalyticsContext();
  if (!context) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!context.canManage) return NextResponse.json({ error: "Apenas administradores podem alterar a integração" }, { status: 403 });
  const body = await req.json().catch(() => null) as { pipeline_id?: string | null; stage_id?: string | null; assigned_to?: string | null } | null;
  const admin = createAdminSupabaseClient();
  if (body?.stage_id) {
    const { data: stage } = await admin.from("crm_stages").select("id,pipeline_id,crm_pipelines!inner(user_id)")
      .eq("id", body.stage_id).eq("pipeline_id", body.pipeline_id).eq("crm_pipelines.user_id", context.ownerId).maybeSingle();
    if (!stage) return NextResponse.json({ error: "Etapa ou pipeline inválida" }, { status: 400 });
  }
  const { data, error } = await admin.from("site_analytics_settings").upsert({
    user_id: context.ownerId, site_key: "genesycompany", name: "Site Genesy", domain: "genesycompany.com",
    form_slug: "formgenesysite", crm_pipeline_id: body?.pipeline_id ?? null,
    crm_stage_id: body?.stage_id ?? null, assigned_to: body?.assigned_to ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,site_key" }).select("*").single();
  return NextResponse.json(error ? { error: error.message } : { settings: data }, { status: error ? 500 : 200 });
}

