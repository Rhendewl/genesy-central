import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const DEFAULT_FOLDER_COLOR = "#4a8fd4";
const isValidColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value);

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("form_folders")
    .select("*")
    .eq("user_id", user.id)
    .order("position")
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ folders: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as { name?: string; color?: string } | null;
  const name = body?.name?.trim();
  const color = body?.color?.trim() || DEFAULT_FOLDER_COLOR;
  if (!name) return NextResponse.json({ error: "Nome da pasta é obrigatório" }, { status: 400 });
  if (name.length > 80) return NextResponse.json({ error: "Use no máximo 80 caracteres" }, { status: 400 });
  if (!isValidColor(color)) return NextResponse.json({ error: "Cor da pasta inválida" }, { status: 400 });

  const { data: duplicate } = await supabase
    .from("form_folders")
    .select("id")
    .eq("user_id", user.id)
    .ilike("name", name)
    .maybeSingle();
  if (duplicate) return NextResponse.json({ error: "Já existe uma pasta com este nome" }, { status: 409 });

  const { data, error } = await supabase
    .from("form_folders")
    .insert({ user_id: user.id, created_by: user.id, name, color })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ folder: data }, { status: 201 });
}
