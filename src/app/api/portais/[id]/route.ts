import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// PUT /api/portais/[id] — update portal
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json();
  const { client_id, name, slug, status, ad_account_ids } = body as {
    client_id?: string | null;
    name?: string;
    slug?: string;
    status?: string;
    ad_account_ids?: string[];
  };

  // Verify ownership
  const { data: portal } = await supabase
    .from("portals")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!portal) return NextResponse.json({ error: "Portal não encontrado" }, { status: 404 });

  // Check slug uniqueness (if changing slug)
  if (slug) {
    const { data: existing } = await supabase
      .from("portals")
      .select("id")
      .eq("slug", slug)
      .neq("id", id)
      .maybeSingle();
    if (existing) return NextResponse.json({ error: "Este slug já está em uso" }, { status: 409 });
  }

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (slug !== undefined) updates.slug = slug;
  if (status !== undefined) updates.status = status;
  if (client_id !== undefined) updates.client_id = client_id || null;

  if (Object.keys(updates).length > 0) {
    const { error: updErr } = await supabase
      .from("portals")
      .update(updates)
      .eq("id", id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // Replace ad accounts if provided
  if (ad_account_ids !== undefined) {
    await supabase.from("portal_accounts").delete().eq("portal_id", id);
    if (ad_account_ids.length > 0) {
      const rows = ad_account_ids.map((account_id) => ({ portal_id: id, ad_account_id: account_id }));
      const { error: accErr } = await supabase.from("portal_accounts").insert(rows);
      if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/portais/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { error } = await supabase
    .from("portals")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// PATCH /api/portais/[id] — toggle status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { status } = await req.json();

  const { error } = await supabase
    .from("portals")
    .update({ status })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
