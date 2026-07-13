// PATCH  /api/workspace/notes/folders/[id] — atualiza name/color/tags/client_id/order_index
// DELETE /api/workspace/notes/folders/[id] — remove pasta (notas dentro viram "sem pasta" via ON DELETE SET NULL)

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { UpdateWorkspaceNoteFolder, WorkspaceNoteFolder } from "@/types/workspace-notes";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as UpdateWorkspaceNoteFolder | null;
  if (!body) return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const key of ["name", "color", "tags", "client_id", "order_index"] as const) {
    if (key in body) patch[key] = body[key];
  }
  if ("name" in patch && typeof patch.name === "string") {
    if (!patch.name.trim()) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    patch.name = (patch.name as string).trim();
  }

  try {
    const { data, error } = await supabase
      .from("workspace_note_folders")
      .update(patch)
      .eq("id", id)
      .select("*, agency_clients(name), workspace_notes(count)")
      .single();

    if (error) throw new Error(error.message);
    const row = data as typeof data & { agency_clients: { name: string } | null; workspace_notes: { count: number }[] };
    const { agency_clients, workspace_notes, ...rest } = row;
    return NextResponse.json({
      folder: { ...rest, client_name: agency_clients?.name ?? null, note_count: workspace_notes?.[0]?.count ?? 0 } as WorkspaceNoteFolder,
    });
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
    const { error } = await supabase.from("workspace_note_folders").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
