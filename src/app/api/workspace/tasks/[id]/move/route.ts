// PATCH /api/workspace/tasks/[id]/move
// Body: { status, ordered_ids } — ordered_ids é a lista completa (em ordem)
// de tarefas da coluna de destino após o drop; a tarefa [id] deve estar nela.
// Reindexa position em passos de 10 para toda a coluna afetada.

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { getPlatformEventBus } from "@/lib/event-bus/platform";
import { handleMirrorStatusChange } from "@/lib/onboarding/sync";
import { verifyWorkspaceTaskExecutor } from "@/lib/workspace/task-authorization";
import type { WorkspaceTaskStatus } from "@/types/workspace";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as { status?: string; ordered_ids?: string[] } | null;
  if (!body?.status || !Array.isArray(body.ordered_ids)) {
    return NextResponse.json({ error: "status e ordered_ids são obrigatórios" }, { status: 400 });
  }
  if (!body.ordered_ids.includes(id)) {
    return NextResponse.json({ error: "ordered_ids deve incluir a tarefa movida" }, { status: 400 });
  }

  const validStatuses = ["a_fazer", "em_andamento", "aguardando", "concluido"];
  if (!validStatuses.includes(body.status)) {
    return NextResponse.json({ error: "status inválido" }, { status: 400 });
  }

  try {
    const access = await verifyWorkspaceTaskExecutor(supabase, id, user.id);
    if (!access.allowed) return NextResponse.json({ error: access.error }, { status: access.status });

    // A RLS mantém os campos administrativos exclusivos do criador. A rota
    // já validou acima que o ator é criador ou responsável e usa o cliente
    // administrativo somente para a mudança operacional de etapa.
    const db = createAdminSupabaseClient();

    // 0. Estado anterior — necessário pra saber se o status realmente mudou
    //    (reordenar dentro da mesma coluna não deve gerar notificação) e pra
    //    montar a mensagem (título + responsáveis) sem uma segunda rodada.
    const { data: before } = await db
      .from("workspace_tasks")
      .select("title, status, user_id")
      .eq("id", id)
      .maybeSingle();

    // 1. Move a tarefa arrastada para a nova coluna, atualiza completed_at
    if (!before) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });

    const { error: statusErr } = await db
      .from("workspace_tasks")
      .update({
        status:       body.status,
        completed_at: body.status === "concluido" ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (statusErr) throw new Error(statusErr.message);

    // 2. Reindexa apenas IDs pertencentes ao mesmo Workspace da tarefa. Isso
    // mantém a ordem visual consistente sem permitir IDs de outra conta.
    const { data: workspaceTasks, error: workspaceTasksError } = await db
      .from("workspace_tasks")
      .select("id")
      .in("id", body.ordered_ids)
      .eq("user_id", before.user_id);
    if (workspaceTasksError) throw new Error(workspaceTasksError.message);
    const workspaceTaskIds = new Set((workspaceTasks ?? []).map((task) => task.id));
    await Promise.all(
      body.ordered_ids.map((taskId, idx) => (
        workspaceTaskIds.has(taskId)
          ? db.from("workspace_tasks").update({ position: idx * 10 }).eq("id", taskId)
          : Promise.resolve()
      ))
    );

    // 3. Se a tarefa é o espelho de uma onboarding_task, propaga o novo status
    //    pro registro mestre (e reavalia dependentes bloqueadas) — só quando o
    //    status de fato mudou, mesma guarda da notificação abaixo.
    if (before && before.status !== body.status) {
      const { data: actorProfile } = await db
        .from("user_profiles")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      await handleMirrorStatusChange(db, id, body.status as WorkspaceTaskStatus, actorProfile?.id ?? null);
    }

    // 4. Notifica os responsáveis (exceto quem moveu) — só quando o status
    //    de fato mudou, nunca numa simples reordenação na mesma coluna.
    if (before && before.status !== body.status) {
      const { data: assigneeRows } = await db
        .from("workspace_task_assignees")
        .select("assignee_id")
        .eq("task_id", id);

      const assigneeIds = (assigneeRows ?? []).map((r) => r.assignee_id);
      if (assigneeIds.length > 0) {
        await getPlatformEventBus().publish(body.status === "concluido" ? "task.completed" : "task.status_changed", {
          taskId:      id,
          taskTitle:   before.title,
          assigneeIds,
          actorUserId: user.id,
          fromStatus:  before.status,
          toStatus:    body.status,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
