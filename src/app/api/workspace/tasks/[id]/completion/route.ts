import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { getPlatformEventBus } from "@/lib/event-bus/platform";
import { handleMirrorStatusChange } from "@/lib/onboarding/sync";
import { verifyWorkspaceTaskExecutor } from "@/lib/workspace/task-authorization";
import type { WorkspaceTaskStatus } from "@/types/workspace";

type Params = { params: Promise<{ id: string }> };

// A conclusão é uma ação operacional, separada da edição da tarefa:
// criador e responsáveis podem concluir/reabrir, mas somente o criador pode
// alterar os demais campos pela rota principal.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as { completed?: boolean } | null;
  if (typeof body?.completed !== "boolean") {
    return NextResponse.json({ error: "completed é obrigatório" }, { status: 400 });
  }

  try {
    const access = await verifyWorkspaceTaskExecutor(supabase, id, user.id);
    if (!access.allowed) return NextResponse.json({ error: access.error }, { status: access.status });

    const db = createAdminSupabaseClient();
    const { data: before, error: beforeError } = await db
      .from("workspace_tasks")
      .select("title,status,board_id")
      .eq("id", id)
      .maybeSingle();
    if (beforeError) throw new Error(beforeError.message);
    if (!before) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });

    const status: WorkspaceTaskStatus = body.completed ? "concluido" : "a_fazer";
    if (before.status === status) return NextResponse.json({ ok: true, status });

    const { error: updateError } = await db
      .from("workspace_tasks")
      .update({
        status,
        completed_at: body.completed ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (updateError) throw new Error(updateError.message);

    const { data: actorProfile } = await db
      .from("user_profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    await handleMirrorStatusChange(db, id, status, actorProfile?.id ?? null);

    const { data: assigneeRows } = await db
      .from("workspace_task_assignees")
      .select("assignee_id")
      .eq("task_id", id);
    const assigneeIds = (assigneeRows ?? []).map((row) => row.assignee_id);

    if (assigneeIds.length > 0) {
      await getPlatformEventBus().publish(body.completed ? "task.completed" : "task.status_changed", {
        taskId: id,
        boardId: before.board_id,
        taskTitle: before.title,
        assigneeIds,
        actorUserId: user.id,
        fromStatus: before.status,
        toStatus: status,
      });
    }

    return NextResponse.json({ ok: true, status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
