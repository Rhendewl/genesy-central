import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("crm_pipelines")
    .select("*, crm_stages(*)")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Pipeline não encontrado" }, { status: 404 });
  return NextResponse.json({ pipeline: data });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  const allowed = ["name", "description", "color", "icon", "order_index", "is_active"] as const;
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }
  if (typeof update.name === "string") update.name = (update.name as string).trim();

  const { data, error } = await supabase
    .from("crm_pipelines")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) return NextResponse.json({ error: "Pipeline não encontrado" }, { status: 404 });
  return NextResponse.json({ pipeline: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Soft delete — preserves lead history
  const { error } = await supabase
    .from("crm_pipelines")
    .update({ is_active: false })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
