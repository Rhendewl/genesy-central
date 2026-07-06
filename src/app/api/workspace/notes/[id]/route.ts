// GET    /api/workspace/notes/[id] — nota completa (incl. content)
// PATCH  /api/workspace/notes/[id] — atualiza title/content/cover_url/color/tags
// DELETE /api/workspace/notes/[id] — remove nota + limpa storage por prefixo

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { UpdateWorkspaceNote, WorkspaceNote } from "@/types/workspace-notes";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const { data, error } = await supabase.from("workspace_notes").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: "Nota não encontrada" }, { status: 404 });

    return NextResponse.json({ note: data as WorkspaceNote });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as UpdateWorkspaceNote | null;
  if (!body) return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const key of ["title", "content", "cover_url", "color", "tags"] as const) {
    if (key in body) patch[key] = body[key];
  }

  try {
    const { data, error } = await supabase
      .from("workspace_notes")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ note: data as WorkspaceNote });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const prefix = `workspace-notes/${user.id}/${id}`;
    const { data: files } = await supabase.storage.from("criativos").list(prefix);
    if (files && files.length > 0) {
      await supabase.storage.from("criativos").remove(files.map((f) => `${prefix}/${f.name}`));
    }

    const { error } = await supabase.from("workspace_notes").delete().eq("id", id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
