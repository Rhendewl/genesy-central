import { NextRequest, NextResponse } from "next/server";
import { resolveSite, siteCors } from "@/lib/site-analytics";
type Params = { params: Promise<{ siteKey: string }> };
export function OPTIONS(req: NextRequest) { return new NextResponse(null, { status: 204, headers: siteCors(req) }); }
export async function POST(req: NextRequest, { params }: Params) {
  const { siteKey } = await params;
  const { db, site } = await resolveSite(siteKey);
  if (!site) return NextResponse.json({ error: "Site não configurado" }, { status: 404, headers: siteCors(req) });
  const body = await req.json().catch(() => null) as { token?: string; events?: Array<Record<string, unknown>> } | null;
  if (!body?.token || !body.events?.length || body.events.length > 50) return NextResponse.json({ error: "Payload inválido" }, { status: 400, headers: siteCors(req) });
  const { data: session } = await db.from("site_analytics_sessions").select("id").eq("token", body.token).eq("site_key", siteKey).maybeSingle();
  if (!session) return NextResponse.json({ error: "Sessão inválida" }, { status: 401, headers: siteCors(req) });
  const rows = body.events.map(event => ({
    user_id: site.user_id, session_id: session.id,
    event_type: String(event.type ?? "event"), path: event.path ? String(event.path) : null,
    section: event.section ? String(event.section) : null,
    duration_seconds: Number.isFinite(event.duration_seconds) ? Math.round(Number(event.duration_seconds)) : null,
    metadata: typeof event.metadata === "object" && event.metadata ? event.metadata : {},
    idempotency_key: event.idempotency_key ? String(event.idempotency_key) : null,
  }));
  const { error } = await db.from("site_analytics_events").upsert(rows, { onConflict: "idempotency_key", ignoreDuplicates: true });
  return NextResponse.json(error ? { error: error.message } : { ok: true }, { status: error ? 500 : 200, headers: siteCors(req) });
}

