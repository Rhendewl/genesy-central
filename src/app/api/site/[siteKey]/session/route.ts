import { NextRequest, NextResponse } from "next/server";
import { resolveSite, siteCors } from "@/lib/site-analytics";

type Params = { params: Promise<{ siteKey: string }> };
export function OPTIONS(req: NextRequest) { return new NextResponse(null, { status: 204, headers: siteCors(req) }); }

export async function POST(req: NextRequest, { params }: Params) {
  const { siteKey } = await params;
  const { db, site } = await resolveSite(siteKey);
  if (!site) return NextResponse.json({ error: "Site não configurado" }, { status: 404, headers: siteCors(req) });
  const body = await req.json().catch(() => ({})) as Record<string, string | undefined>;
  const { data, error } = await db.from("site_analytics_sessions").insert({
    user_id: site.user_id, site_key: siteKey,
    visitor_id: body.visitor_id ?? null, landing_path: body.path ?? null,
    referrer: body.referrer ?? req.headers.get("referer"),
    utm_source: body.utm_source ?? null, utm_medium: body.utm_medium ?? null,
    utm_campaign: body.utm_campaign ?? null, utm_term: body.utm_term ?? null,
    utm_content: body.utm_content ?? null, device: body.device ?? null,
    browser: body.browser ?? null, language: body.language ?? req.headers.get("accept-language")?.split(",")[0] ?? null,
  }).select("token").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: siteCors(req) });
  return NextResponse.json({ token: data.token }, { status: 201, headers: siteCors(req) });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { siteKey } = await params;
  const { db, site } = await resolveSite(siteKey);
  if (!site) return NextResponse.json({ error: "Site não configurado" }, { status: 404, headers: siteCors(req) });
  const body = await req.json().catch(() => ({})) as { token?: string; active_seconds?: number; page_views?: number; ended?: boolean };
  if (!body.token) return NextResponse.json({ error: "Token obrigatório" }, { status: 400, headers: siteCors(req) });
  const update: Record<string, unknown> = { last_seen_at: new Date().toISOString() };
  if (Number.isFinite(body.active_seconds)) update.active_seconds = Math.max(0, Math.round(body.active_seconds!));
  if (Number.isFinite(body.page_views)) update.page_views = Math.max(1, Math.round(body.page_views!));
  if (body.ended) update.ended_at = new Date().toISOString();
  const { error } = await db.from("site_analytics_sessions").update(update)
    .eq("token", body.token).eq("site_key", siteKey).eq("user_id", site.user_id);
  return NextResponse.json(error ? { error: error.message } : { ok: true }, { status: error ? 500 : 200, headers: siteCors(req) });
}

