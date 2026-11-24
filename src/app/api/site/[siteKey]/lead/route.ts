import { NextRequest, NextResponse } from "next/server";
import { crmSourceFor, resolveSite, siteCors, syncSiteLead } from "@/lib/site-analytics";
import { parsePixelInput, recordPixelEvent } from "@/lib/site-meta-pixel";
type Params = { params: Promise<{ siteKey: string }> };
type LeadBody = { token?: string; name?: string; phone?: string; email?: string; profile?: string; monthly_vgv?: string; website?: string; pixel?: unknown };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function OPTIONS(req: NextRequest) { return new NextResponse(null, { status: 204, headers: siteCors(req) }); }
export async function POST(req: NextRequest, { params }: Params) {
  const { siteKey } = await params;
  const { db, site } = await resolveSite(siteKey);
  if (!site) return NextResponse.json({ error: "Site não configurado" }, { status: 404, headers: siteCors(req) });
  const body = await req.json().catch(() => null) as LeadBody | null;
  if (!body?.name?.trim() || !body.phone?.trim()) return NextResponse.json({ error: "Nome e WhatsApp são obrigatórios" }, { status: 400, headers: siteCors(req) });
  if (body.website) return NextResponse.json({ accepted: true }, { status: 202, headers: siteCors(req) });
  const email = body.email?.trim().toLowerCase().slice(0, 200) || null;
  if (email && !EMAIL.test(email)) return NextResponse.json({ error: "E-mail inválido" }, { status: 400, headers: siteCors(req) });
  const { data: session } = body.token ? await db.from("site_analytics_sessions").select("id,visitor_id").eq("token", body.token).eq("site_key", siteKey).maybeSingle() : { data: null };
  const { data: lead, error } = await db.from("site_analytics_leads").insert({
    user_id: site.user_id, site_key: siteKey, session_id: session?.id ?? null,
    name: body.name.trim().slice(0, 160), phone: body.phone.trim().slice(0, 40), email,
    profile: body.profile?.trim().slice(0, 120) || null,
    monthly_vgv: body.monthly_vgv?.trim().slice(0, 120) || null,
    source: crmSourceFor(siteKey),
  }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: siteCors(req) });
  const sync = await syncSiteLead(lead.id);
  // Pixel do Facebook: registra o Lead do navegador e envia pela API de Conversões com o contato (criptografado).
  const pixel = parsePixelInput(body.pixel);
  if (pixel && pixel.event === "Lead") {
    await recordPixelEvent(db, site, session?.id ?? null, pixel, req, { visitorId: session?.visitor_id ?? null, name: body.name, phone: body.phone, email }).catch(() => undefined);
  }
  return NextResponse.json({ lead_id: lead.id, sync }, { status: 201, headers: siteCors(req) });
}
