import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken } from "@/lib/crypto";

// Pixel do Facebook do Site Genesy: registro dos eventos e envio pela API de Conversões (servidor).
const GRAPH = "https://graph.facebook.com/v21.0";
export const PIXEL_EVENTS = new Set(["PageView", "ViewContent", "Contact", "Lead"]);

export type SitePixelSettings = {
  user_id: string;
  site_key: string;
  meta_pixel_enabled?: boolean | null;
  meta_pixel_id?: string | null;
  meta_capi_token_encrypted?: string | null;
  meta_test_event_code?: string | null;
};

export type PixelEventInput = {
  event: string;
  event_id: string;
  loaded?: boolean;
  fbp?: string | null;
  fbc?: string | null;
  url?: string | null;
};

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const clean = (value: unknown, max = 300) => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null);

export function pixelActive(site: SitePixelSettings) {
  return Boolean(site.meta_pixel_enabled && site.meta_pixel_id);
}

export function parsePixelInput(raw: unknown): PixelEventInput | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const event = clean(value.event, 40);
  const eventId = clean(value.event_id, 80);
  if (!event || !eventId || !PIXEL_EVENTS.has(event)) return null;
  return { event, event_id: eventId, loaded: value.loaded === true, fbp: clean(value.fbp), fbc: clean(value.fbc), url: clean(value.url, 1000) };
}

function requestContext(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
  return { ip, userAgent: req.headers.get("user-agent") };
}

/** Normaliza o telefone para o padrão internacional (Brasil por padrão) antes do hash. */
function normalizedPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return digits.length <= 11 ? `55${digits}` : digits;
}
function normalizedFirstName(name: string) {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return first.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() || null;
}

async function sendConversionsApi(site: SitePixelSettings, event: PixelEventInput, req: NextRequest, extra: { visitorId?: string | null; name?: string | null; phone?: string | null }) {
  if (!site.meta_capi_token_encrypted || !site.meta_pixel_id) return null;
  const { ip, userAgent } = requestContext(req);
  const userData: Record<string, unknown> = {};
  if (ip) userData.client_ip_address = ip;
  if (userAgent) userData.client_user_agent = userAgent;
  if (event.fbp) userData.fbp = event.fbp;
  if (event.fbc) userData.fbc = event.fbc;
  if (extra.visitorId) userData.external_id = [sha256(extra.visitorId)];
  const phone = extra.phone ? normalizedPhone(extra.phone) : null;
  if (phone) userData.ph = [sha256(phone)];
  const firstName = extra.name ? normalizedFirstName(extra.name) : null;
  if (firstName) userData.fn = [sha256(firstName)];
  const body: Record<string, unknown> = {
    data: [{
      event_name: event.event,
      event_time: Math.floor(Date.now() / 1000),
      event_id: event.event_id,
      action_source: "website",
      event_source_url: event.url ?? "https://genesycompany.com/",
      user_data: userData,
    }],
  };
  if (site.meta_test_event_code) body.test_event_code = site.meta_test_event_code;
  try {
    const token = decryptToken(site.meta_capi_token_encrypted);
    const response = await fetch(`${GRAPH}/${site.meta_pixel_id}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000),
    });
    if (response.ok) return { status: "sent" as const, error: null };
    const json = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    return { status: "failed" as const, error: (json?.error?.message ?? `Erro ${response.status}`).slice(0, 300) };
  } catch (error) {
    return { status: "failed" as const, error: error instanceof Error ? error.message.slice(0, 300) : "Falha de conexão com o Facebook" };
  }
}

/**
 * Registra um evento do Pixel (o que o navegador disparou) e, quando a API de Conversões
 * estiver configurada, envia o mesmo evento pelo servidor com o mesmo event_id
 * (o Facebook usa esse id para não contar duas vezes).
 */
export async function recordPixelEvent(db: SupabaseClient, site: SitePixelSettings, sessionId: string | null, event: PixelEventInput, req: NextRequest,
  extra: { visitorId?: string | null; name?: string | null; phone?: string | null; logBrowser?: boolean } = {}) {
  if (!pixelActive(site)) return;
  const rows: Array<Record<string, unknown>> = [];
  if (extra.logBrowser !== false) {
    rows.push({ user_id: site.user_id, site_key: site.site_key, session_id: sessionId, event_name: event.event, event_id: event.event_id, channel: "browser", status: event.loaded ? "sent" : "blocked" });
  }
  const server = await sendConversionsApi(site, event, req, extra);
  if (server) rows.push({ user_id: site.user_id, site_key: site.site_key, session_id: sessionId, event_name: event.event, event_id: event.event_id, channel: "server", status: server.status, error: server.error });
  if (rows.length) await db.from("site_analytics_pixel_events").upsert(rows, { onConflict: "event_id,channel", ignoreDuplicates: true });
}

/** Confere se o ID do Pixel e o token funcionam, consultando o Pixel no Facebook. */
export async function verifyPixelAccess(pixelId: string, token: string) {
  try {
    const response = await fetch(`${GRAPH}/${pixelId}?fields=name&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(8000) });
    const json = await response.json().catch(() => null) as { name?: string; error?: { message?: string } } | null;
    if (response.ok) return { ok: true as const, name: json?.name ?? null };
    return { ok: false as const, error: json?.error?.message ?? `Erro ${response.status}` };
  } catch {
    return { ok: false as const, error: "Não foi possível falar com o Facebook agora." };
  }
}
