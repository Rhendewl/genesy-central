// GET  /api/workspace/notes/folders — lista pastas (com contagem de notas e nome do cliente vinculado)
// POST /api/workspace/notes/folders — cria pasta

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { WorkspaceNoteFolder } from "@/types/workspace-notes";

type FolderRow = Omit<WorkspaceNoteFolder, "note_count" | "client_name"> & {
  agency_clients: { name: string } | null;
  workspace_notes: { count: number }[];
};

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const url = new URL(req.url);
  // De quem é este Workspace — o próprio por padrão, ou um colega sendo
  // visualizado via Painel Equipe (a RLS decide se isso é permitido).
  const targetUserId = url.searchParams.get("as_user_id") || user.id;

  try {
    const { data, error } = await supabase
      .from("workspace_note_folders")
      .select("*, agency_clients(name), workspace_notes(count)")
      .eq("user_id", targetUserId)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);

    const folders: WorkspaceNoteFolder[] = ((data ?? []) as unknown as FolderRow[]).map((row) => {
      const { agency_clients, workspace_notes, ...rest } = row;
      return {
        ...rest,
        client_name: agency_clients?.name ?? null,
        note_count: workspace_notes?.[0]?.count ?? 0,
      };
    });

    return NextResponse.json({ folders });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    name?: string; color?: string | null; tags?: string[]; client_id?: string | null; user_id?: string;
  } | null;

  if (!body?.name?.trim()) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from("workspace_note_folders")
      .insert({
        // user_id só enviado quando o admin cria "em nome de" um colega —
        // RLS (is_admin_of_user) valida; sem isso o trigger usa o próprio uid.
        ...(body.user_id ? { user_id: body.user_id } : {}),
        created_by: user.id,
        name: body.name.trim(),
        color: body.color ?? null,
        tags: body.tags ?? [],
        client_id: body.client_id ?? null,
      })
      .select("*, agency_clients(name)")
      .single();

    if (error) throw new Error(error.message);
    const { agency_clients, ...rest } = data as typeof data & { agency_clients: { name: string } | null };
    return NextResponse.json({
      folder: { ...rest, note_count: 0, client_name: agency_clients?.name ?? null } as WorkspaceNoteFolder,
    }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
