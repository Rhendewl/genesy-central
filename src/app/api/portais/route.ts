import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// GET /api/portais — list all portals for current user
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("portals")
    .select("*, client:agency_clients(id,name), portal_accounts(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ portals: data });
}

// POST /api/portais — create a new portal
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json();
  const { client_id, name, slug, status, ad_account_ids } = body as {
    client_id: string | null;
    name: string;
    slug: string;
    status: string;
    ad_account_ids: string[];
  };

  if (!name || !slug) {
    return NextResponse.json({ error: "Nome e slug são obrigatórios" }, { status: 400 });
  }

  // Check slug uniqueness
  const { data: existing } = await supabase
    .from("portals")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Este slug já está em uso" }, { status: 409 });
  }

  // Create portal
  const { data: portal, error: portalErr } = await supabase
    .from("portals")
    .insert({ user_id: user.id, client_id: client_id || null, name, slug, status: status || "ativo" })
    .select()
    .single();

  if (portalErr) return NextResponse.json({ error: portalErr.message }, { status: 500 });

  // Attach ad accounts
  if (ad_account_ids?.length > 0) {
    const accountRows = ad_account_ids.map((account_id: string) => ({
      portal_id: portal.id,
      ad_account_id: account_id,
    }));
    const { error: accErr } = await supabase.from("portal_accounts").insert(accountRows);
    if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 });
  }

  return NextResponse.json({ portal }, { status: 201 });
}
