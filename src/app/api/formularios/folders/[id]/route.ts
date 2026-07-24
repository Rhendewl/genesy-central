import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const isValidColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value);

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as { name?: string; color?: string } | null;
  const name = body?.name?.trim();
  const color = body?.color?.trim();
  if (!name) return NextResponse.json({ error: "Nome da pasta é obrigatório" }, { status: 400 });
  if (name.length > 80) return NextResponse.json({ error: "Use no máximo 80 caracteres" }, { status: 400 });
  if (color && !isValidColor(color)) return NextResponse.json({ error: "Cor da pasta inválida" }, { status: 400 });

  const { data: duplicate } = await supabase
    .from("form_folders")
    .select("id")
    .eq("user_id", user.id)
    .ilike("name", name)
    .neq("id", id)
    .maybeSingle();
  if (duplicate) return NextResponse.json({ error: "Já existe uma pasta com este nome" }, { status: 409 });

  const { data, error } = await supabase
    .from("form_folders")
    .update({ name, ...(color ? { color } : {}) })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Pasta não encontrada" }, { status: 404 });
  return NextResponse.json({ folder: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { error } = await supabase
    .from("form_folders")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
