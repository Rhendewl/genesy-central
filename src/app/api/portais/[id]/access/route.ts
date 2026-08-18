import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { generatePortalAccessToken, hashPortalAccessToken } from "@/lib/portal-access";

const DEFAULT_EXPIRY_DAYS = 30;
const MAX_EXPIRY_DAYS = 90;

async function getOwnedPortal(id: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, portal: null };
  const { data: portal } = await supabase
    .from("portals")
    .select("id, slug, status")
    .eq("id", id)
    .maybeSingle();
  return { supabase, user, portal };
}

// Gera um link opaco e expirante. O token em texto puro só existe nesta resposta.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, user, portal } = await getOwnedPortal(id);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!portal) return NextResponse.json({ error: "Portal não encontrado" }, { status: 404 });
  if (portal.status !== "ativo") return NextResponse.json({ error: "Ative o portal antes de gerar um link" }, { status: 409 });

  const body = await req.json().catch(() => ({})) as { expires_in_days?: number };
  const requestedDays = Number(body.expires_in_days ?? DEFAULT_EXPIRY_DAYS);
  const expiryDays = Number.isFinite(requestedDays)
    ? Math.min(MAX_EXPIRY_DAYS, Math.max(1, Math.floor(requestedDays)))
    : DEFAULT_EXPIRY_DAYS;
  const token = generatePortalAccessToken();
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("portal_access_tokens").insert({
    portal_id: portal.id,
    token_hash: hashPortalAccessToken(token),
    expires_at: expiresAt,
    created_by: user.id,
  });
  if (error) return NextResponse.json({ error: "Não foi possível gerar o link seguro" }, { status: 500 });

  const origin = req.nextUrl.origin;
  const accessUrl = `${origin}/portal/${encodeURIComponent(portal.slug)}/access?token=${encodeURIComponent(token)}`;
  return NextResponse.json(
    { access_url: accessUrl, expires_at: expiresAt },
    { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } },
  );
}

// Revoga imediatamente todos os links emitidos para este portal.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, user, portal } = await getOwnedPortal(id);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!portal) return NextResponse.json({ error: "Portal não encontrado" }, { status: 404 });

  const { error } = await supabase
    .from("portal_access_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("portal_id", portal.id)
    .is("revoked_at", null);
  if (error) return NextResponse.json({ error: "Não foi possível revogar os links" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
