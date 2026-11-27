import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import type { LeadAttribution } from "@/lib/crm/tracking";

// POST /api/crm/rastreamento — dados de rastreio (UTM, dispositivo, navegador)
// dos leads informados. A visibilidade de cada lead é conferida com o cliente
// do próprio usuário (RLS de leads, inclusive para membros da equipe); só
// depois as sessões de formulário e do site são lidas com o cliente admin,
// porque essas tabelas são visíveis apenas ao dono do workspace.

const MAX_LEADS = 5000;
const CHUNK = 200;

type SessionRow = {
  id: string; device: string | null; browser: string | null; os?: string | null;
  utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; utm_term: string | null; utm_content: string | null;
  referrer: string | null; fbclid?: string | null; gclid?: string | null; landing_path?: string | null;
};

function chunks<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as { lead_ids?: unknown } | null;
  const requested = Array.isArray(body?.lead_ids)
    ? Array.from(new Set(body.lead_ids.filter((id): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)))).slice(0, MAX_LEADS)
    : [];
  if (!requested.length) return NextResponse.json({ attribution: {} });

  // 1. Só leads que este usuário pode ver.
  const allowed: string[] = [];
  for (const part of chunks(requested)) {
    const { data, error } = await supabase.from("leads").select("id").in("id", part);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    allowed.push(...(data ?? []).map(row => (row as { id: string }).id));
  }
  if (!allowed.length) return NextResponse.json({ attribution: {} });

  const admin = createAdminSupabaseClient();
  const attribution: Record<string, LeadAttribution> = {};

  try {
    // 2. Formulários da plataforma: lead ← resposta ← sessão do formulário.
    const formSessionByLead = new Map<string, string>();
    for (const part of chunks(allowed)) {
      const { data, error } = await admin.from("form_submissions").select("lead_id, session_id, created_at").in("lead_id", part).order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      for (const row of (data ?? []) as Array<{ lead_id: string; session_id: string | null }>) {
        if (row.session_id && !formSessionByLead.has(row.lead_id)) formSessionByLead.set(row.lead_id, row.session_id);
      }
    }
    const formSessions = new Map<string, SessionRow>();
    for (const part of chunks(Array.from(new Set(formSessionByLead.values())))) {
      const { data, error } = await admin.from("form_sessions")
        .select("id, device, browser, os, utm_source, utm_medium, utm_campaign, utm_term, utm_content, referrer, fbclid, gclid")
        .in("id", part);
      if (error) throw new Error(error.message);
      for (const row of (data ?? []) as SessionRow[]) formSessions.set(row.id, row);
    }
    formSessionByLead.forEach((sessionId, leadId) => {
      const s = formSessions.get(sessionId);
      if (s) attribution[leadId] = { channel: "form", device: s.device, browser: s.browser, os: s.os ?? null, utm_source: s.utm_source, utm_medium: s.utm_medium, utm_campaign: s.utm_campaign, utm_term: s.utm_term, utm_content: s.utm_content, referrer: s.referrer, ad_click: !!(s.fbclid || s.gclid) };
    });

    // 3. Páginas do site: lead do site ← sessão do site.
    const pending = allowed.filter(id => !attribution[id]);
    const siteSessionByLead = new Map<string, string>();
    for (const part of chunks(pending)) {
      const { data, error } = await admin.from("site_analytics_leads").select("crm_lead_id, session_id").in("crm_lead_id", part);
      if (error) break; // tabela ausente em ambientes antigos: segue sem o site
      for (const row of (data ?? []) as Array<{ crm_lead_id: string; session_id: string | null }>) {
        if (row.session_id && !siteSessionByLead.has(row.crm_lead_id)) siteSessionByLead.set(row.crm_lead_id, row.session_id);
      }
    }
    const siteSessions = new Map<string, SessionRow>();
    for (const part of chunks(Array.from(new Set(siteSessionByLead.values())))) {
      const { data, error } = await admin.from("site_analytics_sessions")
        .select("id, device, browser, utm_source, utm_medium, utm_campaign, utm_term, utm_content, referrer")
        .in("id", part);
      if (error) break;
      for (const row of (data ?? []) as SessionRow[]) siteSessions.set(row.id, row);
    }
    siteSessionByLead.forEach((sessionId, leadId) => {
      const s = siteSessions.get(sessionId);
      if (s) attribution[leadId] = { channel: "site", device: s.device, browser: s.browser, os: null, utm_source: s.utm_source, utm_medium: s.utm_medium, utm_campaign: s.utm_campaign, utm_term: s.utm_term, utm_content: s.utm_content, referrer: s.referrer, ad_click: false };
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao ler o rastreamento" }, { status: 500 });
  }

  return NextResponse.json({ attribution });
}
