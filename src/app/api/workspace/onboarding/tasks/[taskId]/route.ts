// GET    /api/workspace/onboarding/tasks/[taskId] — tarefa + checklist + comentários + anexos
// PATCH  /api/workspace/onboarding/tasks/[taskId] — atualiza campos estruturais (admin do projeto)
// DELETE /api/workspace/onboarding/tasks/[taskId] — remove tarefa (admin do projeto)
//
// Diferente de PATCH /api/workspace/tasks/[id] (Workspace pessoal, onde RLS já
// resolve tudo sozinha), aqui a distinção "colaborador só conclui/comenta,
// admin edita a estrutura" não dá pra expressar 100% em RLS — a rota checa
// is_admin_of_onboarding_task() explicitamente antes de aceitar estes campos.
// Mudança de status por um colaborador é feita via /move, não aqui.

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { applyOnboardingTaskEditToMirror, recordHistory, removeMirrorForOnboardingTask } from "@/lib/onboarding/sync";
import { renderOnboardingTaskTitle } from "@/lib/onboarding/task-title-tokens";
import { getPlatformEventBus } from "@/lib/event-bus/platform";
import type {
  OnboardingTask, OnboardingTaskAttachment, OnboardingTaskChecklistItem,
  OnboardingTaskComment, OnboardingTaskDetail, UpdateOnboardingTask,
} from "@/types/onboarding";

type Params = { params: Promise<{ taskId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { taskId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const [taskRes, checklistRes, commentsRes, attachmentsRes, depsRes] = await Promise.all([
      supabase.from("onboarding_tasks").select("*").eq("id", taskId).maybeSingle(),
      supabase.from("onboarding_task_checklist_items").select("*").eq("task_id", taskId).order("position"),
      supabase.from("onboarding_task_comments").select("*").eq("task_id", taskId).order("created_at"),
      supabase.from("onboarding_task_attachments").select("*").eq("task_id", taskId).order("created_at"),
      supabase.from("onboarding_task_dependencies").select("depends_on_task_id").eq("task_id", taskId),
    ]);

    if (taskRes.error) throw new Error(taskRes.error.message);
    if (!taskRes.data) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });

    const detail: OnboardingTaskDetail = {
      ...(taskRes.data as OnboardingTask),
      depends_on_task_ids: (depsRes.data ?? []).map((d) => d.depends_on_task_id),
      checklist_items:     (checklistRes.data ?? []) as OnboardingTaskChecklistItem[],
      comments:             (commentsRes.data ?? []) as OnboardingTaskComment[],
      attachments:          (attachmentsRes.data ?? []) as OnboardingTaskAttachment[],
    };

    return NextResponse.json({ task: detail });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { taskId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: isAdmin } = await supabase.rpc("is_admin_of_onboarding_task", { p_task_id: taskId });
  if (!isAdmin) return NextResponse.json({ error: "Apenas administradores podem editar a estrutura da tarefa" }, { status: 403 });

  const body = await req.json().catch(() => null) as (UpdateOnboardingTask & { status?: string; depends_on_task_ids?: string[] }) | null;
  if (!body) return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const key of [
    "title", "description", "role_key", "assignee_profile_id",
    "priority", "due_date", "due_time", "status",
  ] as const) {
    if (key in body) patch[key] = body[key];
  }
  if (patch.status === "concluido") patch.completed_at = new Date().toISOString();
  else if ("status" in patch) patch.completed_at = null;

  try {
    const { data: before } = await supabase.from("onboarding_tasks").select("assignee_profile_id, project_id").eq("id", taskId).maybeSingle();
    if ("title" in patch && typeof patch.title === "string") {
      patch.title = renderOnboardingTaskTitle(patch.title, await getTaskProjectClientName(supabase, taskId));
    }

    const { data, error } = await supabase.from("onboarding_tasks").update(patch).eq("id", taskId).select("*").single();
    if (error) throw new Error(error.message);

    if (
      "assignee_profile_id" in patch
      && data.assignee_profile_id
      && data.assignee_profile_id !== before?.assignee_profile_id
    ) {
      const { data: project } = await supabase.from("onboarding_projects").select("name").eq("id", data.project_id).maybeSingle();
      getPlatformEventBus().publish("onboarding.task_assigned", {
        taskId:            data.id,
        taskTitle:         data.title,
        projectId:         data.project_id,
        projectName:       project?.name ?? "",
        assigneeProfileId: data.assignee_profile_id,
        actorUserId:       user.id,
      });
    }

    if (body.depends_on_task_ids) {
      const { error: deleteError } = await supabase.from("onboarding_task_dependencies").delete().eq("task_id", taskId);
      if (deleteError) throw new Error(deleteError.message);
      if (body.depends_on_task_ids.length > 0) {
        const { error: insertError } = await supabase
          .from("onboarding_task_dependencies")
          .insert(body.depends_on_task_ids.map((depends_on_task_id) => ({ task_id: taskId, depends_on_task_id })));
        if (insertError) throw new Error(insertError.message);
      }
    }

    const { data: actorProfile } = await supabase.from("user_profiles").select("id").eq("auth_user_id", user.id).maybeSingle();
    await recordHistory(supabase, data.project_id, actorProfile?.id ?? null, "task_edited", { task_title: data.title });
    await applyOnboardingTaskEditToMirror(supabase, data);

    return NextResponse.json({ task: data as OnboardingTask });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function getTaskProjectClientName(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, taskId: string): Promise<string | null> {
  const { data: task } = await supabase
    .from("onboarding_tasks")
    .select("project_id")
    .eq("id", taskId)
    .maybeSingle();
  if (!task?.project_id) return null;

  const { data: project } = await supabase
    .from("onboarding_projects")
    .select("client_id")
    .eq("id", task.project_id)
    .maybeSingle();
  if (!project?.client_id) return null;

  const { data: client } = await supabase
    .from("agency_clients")
    .select("name")
    .eq("id", project.client_id)
    .maybeSingle();

  return client?.name ?? null;
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { taskId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: isAdmin } = await supabase.rpc("is_admin_of_onboarding_task", { p_task_id: taskId });
  if (!isAdmin) return NextResponse.json({ error: "Apenas administradores podem excluir tarefas" }, { status: 403 });

  try {
    const { data: task } = await supabase.from("onboarding_tasks").select("project_id, title").eq("id", taskId).maybeSingle();

    await removeMirrorForOnboardingTask(supabase, taskId);

    const { error } = await supabase.from("onboarding_tasks").delete().eq("id", taskId);
    if (error) throw new Error(error.message);

    if (task) {
      const { data: actorProfile } = await supabase.from("user_profiles").select("id").eq("auth_user_id", user.id).maybeSingle();
      await recordHistory(supabase, task.project_id, actorProfile?.id ?? null, "task_deleted", { task_title: task.title });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
