import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { siteAnalyticsContext } from "@/lib/site-analytics-auth";

type Params = { params: Promise<{ id: string }> };

// Remove o lead das métricas do site/página. O lead criado no CRM continua lá.
export async function DELETE(_: Request, { params }: Params) {
  const context = await siteAnalyticsContext();
  if (!context) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!context.canManage) return NextResponse.json({ error: "Apenas administradores podem excluir leads" }, { status: 403 });
  const { id } = await params;
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.from("site_analytics_leads").delete()
    .eq("id", id).eq("user_id", context.ownerId).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
