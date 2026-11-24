import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { siteAnalyticsContext } from "@/lib/site-analytics-auth";
import { siteKeyParam } from "@/lib/site-analytics";

const DAY = 86_400_000;
export async function GET(req: NextRequest) {
  const context = await siteAnalyticsContext();
  if (!context) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const days = Math.min(365, Math.max(1, Number(req.nextUrl.searchParams.get("days") ?? 30)));
  const since = new Date(Date.now() - days * DAY).toISOString();
  const siteKey = siteKeyParam(req.nextUrl.searchParams.get("site"));
  const admin = createAdminSupabaseClient();
  const prevSince = new Date(Date.now() - 2 * days * DAY).toISOString();
  const [{ data: sessions }, { data: events }, { data: leads }, { data: pixelSettings }, { count: prevSessions }, { count: prevLeads }] = await Promise.all([
    admin.from("site_analytics_sessions").select("id,visitor_id,started_at,active_seconds,page_views,device,referrer,utm_source,utm_campaign").eq("user_id", context.ownerId).eq("site_key", siteKey).gte("started_at", since).order("started_at", { ascending: false }),
    admin.from("site_analytics_events").select("event_type,section,metadata,session_id,created_at").eq("user_id", context.ownerId).eq("site_key", siteKey).gte("created_at", since),
    admin.from("site_analytics_leads").select("id,name,phone,email,profile,monthly_vgv,sync_status,sync_error,crm_lead_id,created_at").eq("user_id", context.ownerId).eq("site_key", siteKey).gte("created_at", since).order("created_at", { ascending: false }).limit(200),
    admin.from("site_analytics_settings").select("meta_pixel_enabled,meta_pixel_id,meta_capi_token_encrypted").eq("user_id", context.ownerId).eq("site_key", siteKey).maybeSingle(),
    // Período anterior de mesmo tamanho, para mostrar a variação nos indicadores.
    admin.from("site_analytics_sessions").select("id", { count: "exact", head: true }).eq("user_id", context.ownerId).eq("site_key", siteKey).gte("started_at", prevSince).lt("started_at", since),
    admin.from("site_analytics_leads").select("id", { count: "exact", head: true }).eq("user_id", context.ownerId).eq("site_key", siteKey).gte("created_at", prevSince).lt("created_at", since),
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
  // Origem do tráfego: UTM tem prioridade; senão, domínio de referência; senão "Direto".
  const sourceOf = (row: { utm_source?: string | null; referrer?: string | null }) => {
    if (row.utm_source) return row.utm_source.toLowerCase();
    if (row.referrer) {
      try {
        const host = new URL(row.referrer).hostname.replace(/^www\./, "").replace(/^l\./, "").replace(/^lm\./, "").replace(/^m\./, "");
        if (host.endsWith("genesycompany.com")) return "direto";
        if (/instagram/.test(host)) return "instagram";
        if (/facebook|fb\.com/.test(host)) return "facebook";
        if (/google\./.test(host)) return "google";
        return host;
      } catch { return "direto"; }
    }
    return "direto";
  };
  const count = (values: string[]) => {
    const totals: Record<string, number> = {};
    values.forEach(value => { totals[value] = (totals[value] ?? 0) + 1; });
    return Object.entries(totals).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  };
  const sources = count(sessionRows.map(sourceOf)).slice(0, 8);
  const campaigns = count(sessionRows.filter(row => row.utm_campaign).map(row => String(row.utm_campaign))).slice(0, 8);
  const devices = count(sessionRows.map(row => row.device || "desconhecido"));
  const clickRows = (events ?? []).filter(event => event.event_type === "click");
  const clicks = count(clickRows.map(event => {
    const meta = (event.metadata ?? {}) as { label?: string; kind?: string };
    return meta.kind === "whatsapp" ? "WhatsApp" : meta.kind === "instagram" ? "Instagram" : (meta.label || "Clique").slice(0, 40);
  })).slice(0, 10);
  const formSessions = new Set((events ?? []).filter(event => event.section === "cta" || (event.event_type === "click" && ["formulario", "botao"].includes(String((event.metadata as { kind?: string } | null)?.kind)))).map(event => event.session_id)).size;
  const engaged = sessionRows.filter(row => (row.active_seconds ?? 0) >= 30).length;
  const funnel = [
    { name: "Acessos", value: sessionRows.length },
    { name: "Ficaram 30s+", value: engaged },
    { name: "Chegaram ao formulário", value: formSessions },
    { name: "Viraram lead", value: leadRows.length },
  ];

  // Pixel do Facebook: quantos eventos o site enviou (navegador) e quantos foram pelo servidor.
  const pixelRows = (events ?? []).filter(event => event.event_type === "pixel").map(event => {
    const meta = (event.metadata ?? {}) as { event?: string; channel?: string; status?: string; error?: string | null };
    return { event_name: meta.event ?? "", channel: meta.channel ?? "", status: meta.status ?? "", error: meta.error ?? null, created_at: event.created_at };
  }).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const pixelOrder = ["PageView", "ViewContent", "Contact", "Lead"];
  const pixelTotals = pixelOrder.map(name => {
    const rows = pixelRows.filter(row => row.event_name === name);
    return {
      event: name,
      browser_sent: rows.filter(row => row.channel === "browser" && row.status === "sent").length,
      browser_blocked: rows.filter(row => row.channel === "browser" && row.status === "blocked").length,
      server_sent: rows.filter(row => row.channel === "server" && row.status === "sent").length,
      server_failed: rows.filter(row => row.channel === "server" && row.status === "failed").length,
    };
  });
  const lastFailure = pixelRows.find(row => row.status === "failed");
  const pixel = {
    enabled: Boolean(pixelSettings?.meta_pixel_enabled && pixelSettings?.meta_pixel_id),
    pixel_id: pixelSettings?.meta_pixel_id ?? null,
    capi: Boolean(pixelSettings?.meta_capi_token_encrypted),
    totals: pixelTotals,
    last_event_at: pixelRows[0]?.created_at ?? null,
    last_error: lastFailure ? { message: lastFailure.error, at: lastFailure.created_at } : null,
  };

  return NextResponse.json({
    pixel,
    sources, campaigns, devices, clicks, funnel,
    whatsapp_clicks: clickRows.filter(event => (event.metadata as { kind?: string } | null)?.kind === "whatsapp").length,
    previous: { sessions: prevSessions ?? 0, leads: prevLeads ?? 0 },
    summary: { sessions: sessionRows.length, visitors, views, avg_seconds: avgSeconds, leads: leadRows.length, conversion_rate: sessionRows.length ? Number((leadRows.length / sessionRows.length * 100).toFixed(1)) : 0 },
    timeline: Array.from(byDay.values()), sections: Object.entries(sections).map(([name, value]) => ({ name, value })).sort((a,b) => b.value-a.value),
    leads: leadRows,
  });
}

