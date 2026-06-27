import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { NewForm } from "@/types";

// GET /api/formularios — lista todos os formulários do usuário autenticado
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("forms")
    .select("id, name, slug, status, description, steps, published_at, created_at, updated_at")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ formularios: data });
}

// POST /api/formularios — cria um novo formulário
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json() as NewForm;
  const { name, slug, description } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
  }

  const cleanSlug = slug?.trim()
    ? normalizeSlug(slug)
    : generateSlug(name);

  // Verifica unicidade do slug para este usuário
  const { data: existing } = await supabase
    .from("forms")
    .select("id")
    .eq("user_id", user.id)
    .eq("slug", cleanSlug)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Este slug já está em uso" }, { status: 409 });
  }

  const { data: form, error } = await supabase
    .from("forms")
    .insert({
      user_id: user.id,
      created_by: user.id,
      updated_by: user.id,
      name: name.trim(),
      slug: cleanSlug,
      description: description?.trim() ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ formulario: form }, { status: 201 });
}

function normalizeSlug(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function generateSlug(name: string): string {
  const base = normalizeSlug(name);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}
