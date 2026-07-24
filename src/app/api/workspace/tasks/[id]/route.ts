// GET    /api/workspace/tasks/[id] — tarefa + checklist + comentários + anexos
// PATCH  /api/workspace/tasks/[id] — atualiza campos gerais (não status/position)
// DELETE /api/workspace/tasks/[id] — remove tarefa (cascade nos filhos + limpeza de storage)

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getPlatformEventBus } from "@/lib/event-bus/platform";
import { recordHistory } from "@/lib/onboarding/sync";
import { verifyWorkspaceTaskCreator } from "@/lib/workspace/task-authorization";
import type {
  UpdateWorkspaceTask, WorkspaceTask, WorkspaceTaskDetail,
  WorkspaceTaskChecklistItem, WorkspaceTaskComment, WorkspaceTaskAttachment, WorkspaceMarketingContentLink,
} from "@/types/workspace";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const [taskRes, checklistRes, commentsRes, attachmentsRes, assigneesRes, marketingContentsRes] = await Promise.all([
      supabase.from("workspace_tasks").select("*").eq("id", id).maybeSingle(),
      supabase.from("workspace_task_checklist_items").select("*").eq("task_id", id).order("position"),
      supabase.from("workspace_task_comments").select("*").eq("task_id", id).order("created_at"),
      supabase.from("workspace_task_attachments").select("*").eq("task_id", id).order("created_at"),
      supabase.from("workspace_task_assignees").select("assignee_id").eq("task_id", id),
      supabase.from("marketing_contents").select("id,title,status,scheduled_at").eq("workspace_task_id", id).is("archived_at", null),
    ]);

    if (taskRes.error) throw new Error(taskRes.error.message);
    if (!taskRes.data) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });

    const detail: WorkspaceTaskDetail = {
      ...(taskRes.data as WorkspaceTask),
      assignee_ids:    (assigneesRes.data ?? []).map((a) => a.assignee_id),
      can_edit:         taskRes.data.created_by === user.id,
      checklist_items: (checklistRes.data ?? []) as WorkspaceTaskChecklistItem[],
      comments:        (commentsRes.data ?? [])  as WorkspaceTaskComment[],
      attachments:     (attachmentsRes.data ?? []) as WorkspaceTaskAttachment[],
      linked_marketing_contents: (marketingContentsRes.data ?? []) as WorkspaceMarketingContentLink[],
    };

    return NextResponse.json({ task: detail });
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

  const body = await req.json().catch(() => null) as UpdateWorkspaceTask | null;
  if (!body) return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const key of ["board_id", "title", "description", "priority", "tags", "due_date", "due_time", "color", "notes"] as const) {
    if (key in body) patch[key] = body[key];
  }

  try {
    const access = await verifyWorkspaceTaskCreator(supabase, id, user.id);
    if (!access.allowed) return NextResponse.json({ error: access.error }, { status: access.status });

    const [{ data: beforeTask, error: beforeTaskError }, { data: beforeAssigneesData, error: beforeAssigneesError }] = await Promise.all([
      supabase.from("workspace_tasks").select("*").eq("id", id).maybeSingle(),
      supabase.from("workspace_task_assignees").select("assignee_id").eq("task_id", id),
    ]);
    if (beforeTaskError) throw new Error(beforeTaskError.message);
    if (beforeAssigneesError) throw new Error(beforeAssigneesError.message);
    if (!beforeTask) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });

    if (body.board_id && body.board_id !== beforeTask.board_id) {
      const { data: targetBoard, error: targetBoardError } = await supabase
        .from("workspace_task_boards")
        .select("id")
        .eq("id", body.board_id)
        .maybeSingle();
      if (targetBoardError) throw new Error(targetBoardError.message);
      if (!targetBoard) return NextResponse.json({ error: "Workspace de destino inválido" }, { status: 400 });

      const { data: lastTask } = await supabase
        .from("workspace_tasks")
        .select("position")
        .eq("board_id", body.board_id)
        .eq("status", beforeTask.status)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      patch.position = (lastTask?.position ?? -10) + 10;
    }

    let data = beforeTask;
    if (Object.keys(patch).length > 0) {
      const { data: updated, error } = await supabase
        .from("workspace_tasks")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw new Error(error.message);
      data = updated;
    }

    let assigneeIds: string[];
    if (body.assignee_ids) {
      const previousAssigneeIds = (beforeAssigneesData ?? []).map((a) => a.assignee_id);
      assigneeIds = body.assignee_ids;
      const { error: deleteError } = await supabase.from("workspace_task_assignees").delete().eq("task_id", id);
      if (deleteError) throw new Error(deleteError.message);
      if (assigneeIds.length > 0) {
        const { error: insertError } = await supabase
          .from("workspace_task_assignees")
          .insert(assigneeIds.map((assignee_id) => ({ task_id: id, assignee_id })));
        if (insertError) throw new Error(insertError.message);
      }

      const newAssigneeIds = assigneeIds.filter((assigneeId) => !previousAssigneeIds.includes(assigneeId));
      if (newAssigneeIds.length > 0) {
        await getPlatformEventBus().publish("task.assigned", {
          taskId:      data.id,
          boardId:     data.board_id,
          taskTitle:   data.title,
          assigneeIds: newAssigneeIds,
          actorUserId: user.id,
          priority:    data.priority,
          dueDate:     data.due_date,
        });
      }
    } else {
      assigneeIds = (beforeAssigneesData ?? []).map((a) => a.assignee_id);
    }

    return NextResponse.json({
      task: { ...data, assignee_ids: assigneeIds, can_edit: data.created_by === user.id } as WorkspaceTask,
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
    const access = await verifyWorkspaceTaskCreator(supabase, id, user.id);
    if (!access.allowed) return NextResponse.json({ error: access.error }, { status: access.status });

    const [{ data: attachments }, { data: taskRow }] = await Promise.all([
      supabase.from("workspace_task_attachments").select("storage_path").eq("task_id", id),
      supabase.from("workspace_tasks").select("title, onboarding_task_id").eq("id", id).maybeSingle(),
    ]);

    if (attachments && attachments.length > 0) {
      await supabase.storage.from("criativos").remove(attachments.map((a) => a.storage_path));
    }

    // Espelho de uma onboarding_task: apagar aqui remove só a visualização
    // pessoal — o registro mestre e o histórico do projeto continuam intactos
    // (workspace_tasks.onboarding_task_id -> onboarding_tasks é FK simples,
    // sem cascade nessa direção). Registramos o evento pro histórico do projeto.
    if (taskRow?.onboarding_task_id) {
      const { data: onboardingTask } = await supabase
        .from("onboarding_tasks")
        .select("project_id")
        .eq("id", taskRow.onboarding_task_id)
        .maybeSingle();
      if (onboardingTask) {
        const { data: actorProfile } = await supabase
          .from("user_profiles")
          .select("id")
          .eq("auth_user_id", user.id)
          .maybeSingle();
        await recordHistory(supabase, onboardingTask.project_id, actorProfile?.id ?? null, "task_removed_from_personal_list", {
          task_title: taskRow.title,
        });
      }
    }

    const { error } = await supabase.from("workspace_tasks").delete().eq("id", id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
