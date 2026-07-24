import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { UpdateForm } from "@/types";

type Params = { params: Promise<{ id: string }> };

// GET /api/formularios/:id — carrega um formulário completo (com steps, logic, theme…)
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("forms")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (error || !data) return NextResponse.json({ error: "Formulário não encontrado" }, { status: 404 });
  return NextResponse.json({ formulario: data });
}

// PUT /api/formularios/:id — atualiza qualquer campo do formulário
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json() as UpdateForm;

  if (body.folder_id) {
    const { data: folder } = await supabase
      .from("form_folders")
      .select("id")
      .eq("id", body.folder_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!folder) return NextResponse.json({ error: "Pasta não encontrada" }, { status: 400 });
  }

  // Se o slug foi alterado, verificar unicidade
  if (body.slug) {
    const cleanSlug = normalizeSlug(body.slug);
    const { data: existing } = await supabase
      .from("forms")
      .select("id")
      .eq("user_id", user.id)
      .eq("slug", cleanSlug)
      .is("deleted_at", null)
      .neq("id", id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Este slug já está em uso" }, { status: 409 });
    }
    body.slug = cleanSlug;
  }

  const { data, error } = await supabase
    .from("forms")
    .update({ ...body, updated_by: user.id })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ formulario: data });
}

// PATCH /api/formularios/:id — atualiza status (arquivar, desativar, etc.)
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { status } = await req.json() as { status: string };
  const allowed = ["draft", "published", "archived", "disabled"];
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { status, updated_by: user.id };
  if (status === "published") updates.published_at = new Date().toISOString();

  const { error } = await supabase
    .from("forms")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/formularios/:id — soft delete
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { error } = await supabase
    .from("forms")
    .update({ deleted_at: new Date().toISOString(), status: "archived" })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
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
