import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { siteAnalyticsContext } from "@/lib/site-analytics-auth";
import { syncSiteLead } from "@/lib/site-analytics";
type Params = { params: Promise<{ id: string }> };
export async function POST(_: Request, { params }: Params) {
  const context = await siteAnalyticsContext();
  if (!context) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!context.canManage) return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  const { id } = await params;
  const admin = createAdminSupabaseClient();
  const { data: lead } = await admin.from("site_analytics_leads").select("id").eq("id", id).eq("user_id", context.ownerId).maybeSingle();
  if (!lead) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  const result = await syncSiteLead(id);
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
