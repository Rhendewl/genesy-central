import { NextRequest, NextResponse } from "next/server";
import { resolveSite, siteCors, syncSiteLead } from "@/lib/site-analytics";
import { parsePixelInput, recordPixelEvent } from "@/lib/site-meta-pixel";
type Params = { params: Promise<{ siteKey: string }> };
export function OPTIONS(req: NextRequest) { return new NextResponse(null, { status: 204, headers: siteCors(req) }); }
export async function POST(req: NextRequest, { params }: Params) {
  const { siteKey } = await params;
  const { db, site } = await resolveSite(siteKey);
  if (!site) return NextResponse.json({ error: "Site não configurado" }, { status: 404, headers: siteCors(req) });
  const body = await req.json().catch(() => null) as { token?: string; name?: string; phone?: string; profile?: string; monthly_vgv?: string; website?: string; pixel?: unknown } | null;
  if (!body?.name?.trim() || !body.phone?.trim()) return NextResponse.json({ error: "Nome e WhatsApp são obrigatórios" }, { status: 400, headers: siteCors(req) });
  if (body.website) return NextResponse.json({ accepted: true }, { status: 202, headers: siteCors(req) });
  const { data: session } = body.token ? await db.from("site_analytics_sessions").select("id,visitor_id").eq("token", body.token).eq("site_key", siteKey).maybeSingle() : { data: null };
  const { data: lead, error } = await db.from("site_analytics_leads").insert({
    user_id: site.user_id, site_key: siteKey, session_id: session?.id ?? null,
    name: body.name.trim(), phone: body.phone.trim(), profile: body.profile?.trim() || null,
    monthly_vgv: body.monthly_vgv?.trim() || null,
  }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: siteCors(req) });
  const sync = await syncSiteLead(lead.id);
  // Pixel do Facebook: registra o Lead do navegador e envia pela API de Conversões com o contato (criptografado).
  const pixel = parsePixelInput(body.pixel);
  if (pixel && pixel.event === "Lead") {
    await recordPixelEvent(db, site, session?.id ?? null, pixel, req, { visitorId: session?.visitor_id ?? null, name: body.name, phone: body.phone }).catch(() => undefined);
  }
  return NextResponse.json({ lead_id: lead.id, sync }, { status: 201, headers: siteCors(req) });
}
