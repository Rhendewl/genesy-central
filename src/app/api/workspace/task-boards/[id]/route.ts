import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  normalizeWorkspaceBoardColor,
  normalizeWorkspaceBoardName,
} from "@/lib/workspace/task-board";
import type { WorkspaceTaskBoard } from "@/types/workspace";

type Params = { params: Promise<{ id: string }> };

async function getContext() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, ownerId: null, canManage: false };
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("owner_id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const ownerId = profile?.owner_id ?? user.id;
  return { supabase, user, ownerId, canManage: user.id === ownerId || profile?.role === "admin" };
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const { user, ownerId, canManage } = await getContext();
    if (!user || !ownerId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    if (!canManage) return NextResponse.json({ error: "Sem permissão para editar este workspace" }, { status: 403 });
    const db = createAdminSupabaseClient();

    const body = await req.json().catch(() => null) as { name?: string; color?: string } | null;
    const patch: Record<string, string> = {};
    if (body?.name !== undefined) {
      const name = normalizeWorkspaceBoardName(body.name);
      if (!name) return NextResponse.json({ error: "Informe o nome do workspace" }, { status: 400 });
      patch.name = name;
    }
    if (body?.color !== undefined) patch.color = normalizeWorkspaceBoardColor(body.color);
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nenhuma alteração informada" }, { status: 400 });

    const { data, error } = await db
      .from("workspace_task_boards")
      .update(patch)
      .eq("id", id)
      .eq("user_id", ownerId)
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ board: data as WorkspaceTaskBoard });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao atualizar workspace";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const { user, ownerId, canManage } = await getContext();
    if (!user || !ownerId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    if (!canManage) return NextResponse.json({ error: "Sem permissão para excluir este workspace" }, { status: 403 });
    const db = createAdminSupabaseClient();

    const { data: board, error: boardError } = await db
      .from("workspace_task_boards")
      .select("id,is_default")
      .eq("id", id)
      .eq("user_id", ownerId)
      .maybeSingle();
    if (boardError) throw boardError;
    if (!board) return NextResponse.json({ error: "Workspace não encontrado" }, { status: 404 });
    if (board.is_default) return NextResponse.json({ error: "O workspace Geral não pode ser excluído" }, { status: 400 });

    const { data: defaultBoard, error: defaultError } = await db
      .from("workspace_task_boards")
      .select("id")
      .eq("user_id", ownerId)
      .eq("is_default", true)
      .single();
    if (defaultError) throw defaultError;

    const { error: moveError } = await db
      .from("workspace_tasks")
      .update({ board_id: defaultBoard.id })
      .eq("board_id", id);
    if (moveError) throw moveError;

    const { error: deleteError } = await db
      .from("workspace_task_boards")
      .delete()
      .eq("id", id)
      .eq("user_id", ownerId);
    if (deleteError) throw deleteError;

    return NextResponse.json({ ok: true, fallback_board_id: defaultBoard.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao excluir workspace";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
