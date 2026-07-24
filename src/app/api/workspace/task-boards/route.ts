import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  normalizeWorkspaceBoardColor,
  normalizeWorkspaceBoardName,
} from "@/lib/workspace/task-board";
import type { WorkspaceTaskBoard } from "@/types/workspace";

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
  return {
    supabase,
    user,
    ownerId,
    canManage: user.id === ownerId || profile?.role === "admin",
  };
}

export async function GET() {
  try {
    const { user, ownerId, canManage } = await getContext();
    if (!user || !ownerId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { data, error } = await createAdminSupabaseClient()
      .from("workspace_task_boards")
      .select("*")
      .eq("user_id", ownerId)
      .order("position")
      .order("created_at");
    if (error) throw error;

    return NextResponse.json({ boards: (data ?? []) as WorkspaceTaskBoard[], canManage });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar workspaces";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, ownerId, canManage } = await getContext();
    if (!user || !ownerId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    if (!canManage) return NextResponse.json({ error: "Apenas proprietários e administradores podem criar workspaces" }, { status: 403 });
    const db = createAdminSupabaseClient();

    const body = await req.json().catch(() => null) as { name?: string; color?: string } | null;
    const name = normalizeWorkspaceBoardName(body?.name);
    if (!name) return NextResponse.json({ error: "Informe o nome do workspace" }, { status: 400 });

    const { data: last } = await db
      .from("workspace_task_boards")
      .select("position")
      .eq("user_id", ownerId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await db
      .from("workspace_task_boards")
      .insert({
        user_id: ownerId,
        created_by: user.id,
        name,
        color: normalizeWorkspaceBoardColor(body?.color),
        position: (last?.position ?? 0) + 10,
      })
      .select("*")
      .single();
    if (error) throw error;

    return NextResponse.json({ board: data as WorkspaceTaskBoard }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar workspace";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
