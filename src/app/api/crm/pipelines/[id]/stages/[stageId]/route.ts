import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type Params = { params: Promise<{ id: string; stageId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { stageId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("crm_stages")
    .select("*")
    .eq("id", stageId)
    .single();

  if (error || !data) return NextResponse.json({ error: "Etapa não encontrada" }, { status: 404 });
  return NextResponse.json({ stage: data });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { stageId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  const allowed = [
    "name", "description", "color", "icon", "order_index",
    "is_active", "allow_free_move", "require_note", "require_attachment", "allow_edit",
  ] as const;
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }
  if (typeof update.name === "string") update.name = (update.name as string).trim();

  const { data, error } = await supabase
    .from("crm_stages")
    .update(update)
    .eq("id", stageId)
    .select()
    .single();

  if (error || !data) return NextResponse.json({ error: "Etapa não encontrada" }, { status: 404 });
  return NextResponse.json({ stage: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { stageId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Block deletion if leads are assigned to this stage
  const { count } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("stage_id", stageId);

  if (count && count > 0) {
    return NextResponse.json(
      { error: `Não é possível excluir: ${count} lead(s) nesta etapa` },
      { status: 409 },
    );
  }

  // Soft delete
  const { error } = await supabase
    .from("crm_stages")
    .update({ is_active: false })
    .eq("id", stageId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
