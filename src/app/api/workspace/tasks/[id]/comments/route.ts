// POST /api/workspace/tasks/[id]/comments — cria comentário

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { verifyWorkspaceTaskCreator } from "@/lib/workspace/task-authorization";
import type { WorkspaceTaskComment } from "@/types/workspace";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id: taskId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as { body?: string } | null;
  if (!body?.body) return NextResponse.json({ error: "body é obrigatório" }, { status: 400 });

  try {
    const access = await verifyWorkspaceTaskCreator(supabase, taskId, user.id);
    if (!access.allowed) return NextResponse.json({ error: access.error }, { status: access.status });

    // author_id é nulo quando quem comenta é o dono da conta (sem linha em user_profiles)
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    const { data, error } = await supabase
      .from("workspace_task_comments")
      .insert({ task_id: taskId, author_id: profile?.id ?? null, body: body.body })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ comment: data as WorkspaceTaskComment }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
