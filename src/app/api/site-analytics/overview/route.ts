import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { siteAnalyticsContext } from "@/lib/site-analytics-auth";

const DAY = 86_400_000;
export async function GET(req: NextRequest) {
  const context = await siteAnalyticsContext();
  if (!context) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const days = Math.min(365, Math.max(1, Number(req.nextUrl.searchParams.get("days") ?? 30)));
  const since = new Date(Date.now() - days * DAY).toISOString();
  const admin = createAdminSupabaseClient();
  const [{ data: sessions }, { data: events }, { data: leads }] = await Promise.all([
    admin.from("site_analytics_sessions").select("id,visitor_id,started_at,active_seconds,page_views,device,referrer,utm_source,utm_campaign").eq("user_id", context.ownerId).gte("started_at", since).order("started_at", { ascending: false }),
    admin.from("site_analytics_events").select("event_type,section,created_at").eq("user_id", context.ownerId).gte("created_at", since),
    admin.from("site_analytics_leads").select("id,name,phone,profile,monthly_vgv,sync_status,sync_error,crm_lead_id,created_at").eq("user_id", context.ownerId).gte("created_at", since).order("created_at", { ascending: false }).limit(200),
  ]);
  const sessionRows = sessions ?? [];
  const leadRows = leads ?? [];
  const visitors = new Set(sessionRows.map(row => row.visitor_id || row.id)).size;
  const avgSeconds = sessionRows.length ? Math.round(sessionRows.reduce((sum, row) => sum + (row.active_seconds ?? 0), 0) / sessionRows.length) : 0;
  const views = sessionRows.reduce((sum, row) => sum + (row.page_views ?? 1), 0);
  const byDay = new Map<string, { date: string; sessions: number; views: number; leads: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * DAY).toISOString().slice(0, 10);
    byDay.set(date, { date, sessions: 0, views: 0, leads: 0 });
  }
  sessionRows.forEach(row => { const item = byDay.get(row.started_at.slice(0, 10)); if (item) { item.sessions++; item.views += row.page_views ?? 1; } });
  leadRows.forEach(row => { const item = byDay.get(row.created_at.slice(0, 10)); if (item) item.leads++; });
  const sections: Record<string, number> = {};
  (events ?? []).forEach(event => { if (event.event_type === "section_view" && event.section) sections[event.section] = (sections[event.section] ?? 0) + 1; });
  return NextResponse.json({
    summary: { sessions: sessionRows.length, visitors, views, avg_seconds: avgSeconds, leads: leadRows.length, conversion_rate: sessionRows.length ? Number((leadRows.length / sessionRows.length * 100).toFixed(1)) : 0 },
    timeline: Array.from(byDay.values()), sections: Object.entries(sections).map(([name, value]) => ({ name, value })).sort((a,b) => b.value-a.value),
    leads: leadRows,
  });
}

