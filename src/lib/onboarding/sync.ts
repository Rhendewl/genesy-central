import type { createServerSupabaseClient } from "@/lib/supabase-server";
import type { OnboardingTaskStatus } from "@/types/onboarding";
import type { WorkspaceTaskStatus } from "@/types/workspace";

// ─────────────────────────────────────────────────────────────────────────────
// Sincronização tarefa mestre (onboarding_tasks) ⇄ espelho operacional
// (workspace_tasks, via workspace_tasks.onboarding_task_id).
//
// Roda sempre sob a sessão de quem disparou a ação (o Supabase client é
// recebido por parâmetro, nunca instanciado aqui) — não existe precedente de
// trigger de lógica de negócio cross-table neste schema, e assim conseguimos
// disparar histórico/eventos junto da sincronização. A RLS de
// workspace_tasks/workspace_task_assignees ganhou uma brecha aditiva
// (20260737) para permitir que um colaborador comum crie o espelho de uma
// OUTRA pessoa quando sua ação desbloqueia uma tarefa dependente — sempre
// escopada a um onboarding_task real de um projeto ao qual ele tem acesso.
// ─────────────────────────────────────────────────────────────────────────────

type Supabase = Awaited<ReturnType<typeof createServerSupabaseClient>>;

// Só estes 4 status geram/mantêm um espelho no Workspace pessoal — bloqueado,
// aguardando_cliente e cancelado não aparecem no kanban pessoal até saírem
// desse estado (evita poluir a lista pessoal com tarefas ainda não acionáveis).
const MIRROR_STATUS_MAP: Partial<Record<OnboardingTaskStatus, WorkspaceTaskStatus>> = {
  a_fazer:      "a_fazer",
  em_andamento: "em_andamento",
  aguardando:   "aguardando",
  concluido:    "concluido",
};

const REVERSE_MIRROR_STATUS_MAP: Record<WorkspaceTaskStatus, OnboardingTaskStatus> = {
  a_fazer:      "a_fazer",
  em_andamento: "em_andamento",
  aguardando:   "aguardando",
  concluido:    "concluido",
};

interface OnboardingTaskForMirror {
  id:                  string;
  project_id:          string;
  title:               string;
  description:         string | null;
  assignee_profile_id: string | null;
  priority:            string;
  status:              OnboardingTaskStatus;
  due_date:            string | null;
  due_time?:           string | null;
}

export async function recordHistory(
  supabase: Supabase,
  projectId: string,
  actorProfileId: string | null,
  eventType: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await supabase.from("onboarding_history").insert({
    project_id:       projectId,
    actor_profile_id: actorProfileId,
    event_type:       eventType,
    payload,
  });
}

// Cria o espelho em workspace_tasks para uma onboarding_task, se ainda não
// existir um e as condições permitirem (status acionável + responsável já
// resolvido + responsável já aceitou o convite, isto é, tem auth_user_id).
export async function createMirrorIfNeeded(supabase: Supabase, task: OnboardingTaskForMirror): Promise<void> {
  const mirrorStatus = MIRROR_STATUS_MAP[task.status];
  if (!mirrorStatus || !task.assignee_profile_id) return;

  const { data: existing } = await supabase
    .from("workspace_tasks")
    .select("id")
    .eq("onboarding_task_id", task.id)
    .maybeSingle();
  if (existing) return;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("auth_user_id")
    .eq("id", task.assignee_profile_id)
    .maybeSingle();
  const assigneeAuthId = profile?.auth_user_id;
  if (!assigneeAuthId) return; // convite ainda não aceito — sem Workspace pessoal pra espelhar

  const { data: maxRow } = await supabase
    .from("workspace_tasks")
    .select("position")
    .eq("user_id", assigneeAuthId)
    .eq("status", mirrorStatus)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (maxRow?.position ?? -10) + 10;

  const { data: mirror, error } = await supabase
    .from("workspace_tasks")
    .insert({
      user_id:            assigneeAuthId,
      created_by:         assigneeAuthId,
      title:               task.title,
      description:         task.description,
      status:              mirrorStatus,
      priority:            task.priority,
      due_date:            task.due_date,
      due_time:            task.due_time ?? null,
      position,
      onboarding_task_id:  task.id,
      tags:                [],
    })
    .select("id")
    .single();
  if (error || !mirror) return;

  await supabase.from("workspace_task_assignees").insert({
    user_id:     assigneeAuthId,
    task_id:     mirror.id,
    assignee_id: task.assignee_profile_id,
  });
}

// Remove o espelho (se existir) — usado quando o mestre é excluído/cancelado
// ou reatribuído a outra pessoa. Nunca afeta a onboarding_task em si.
export async function removeMirrorForOnboardingTask(supabase: Supabase, onboardingTaskId: string): Promise<void> {
  const { data: mirror } = await supabase
    .from("workspace_tasks")
    .select("id")
    .eq("onboarding_task_id", onboardingTaskId)
    .maybeSingle();
  if (!mirror) return;

  const { data: attachments } = await supabase
    .from("workspace_task_attachments")
    .select("storage_path")
    .eq("task_id", mirror.id);
  if (attachments && attachments.length > 0) {
    await supabase.storage.from("criativos").remove(attachments.map((a) => a.storage_path));
  }

  await supabase.from("workspace_tasks").delete().eq("id", mirror.id);
}

// Reavalia se alguma tarefa bloqueada esperando por `completedTaskId` já pode
// ser desbloqueada (todas as dependências concluídas) — desbloqueia e cria o
// espelho de quem já estiver atribuído.
async function unblockDependents(supabase: Supabase, completedTaskId: string): Promise<void> {
  const { data: dependents } = await supabase
    .from("onboarding_task_dependencies")
    .select("task_id")
    .eq("depends_on_task_id", completedTaskId);
  const dependentIds = Array.from(new Set((dependents ?? []).map((d) => d.task_id)));
  if (dependentIds.length === 0) return;

  const { data: blockedTasks } = await supabase
    .from("onboarding_tasks")
    .select("id, project_id, title, stage_id, description, assignee_profile_id, priority, status, due_date, due_time")
    .in("id", dependentIds)
    .eq("status", "bloqueado");

  for (const candidate of blockedTasks ?? []) {
    const { data: deps } = await supabase
      .from("onboarding_task_dependencies")
      .select("depends_on_task_id")
      .eq("task_id", candidate.id);
    const depIds = (deps ?? []).map((d) => d.depends_on_task_id);
    if (depIds.length === 0) continue;

    const { data: depTasks } = await supabase.from("onboarding_tasks").select("status").in("id", depIds);
    const allDone = (depTasks ?? []).every((d) => d.status === "concluido");
    if (!allDone) continue;

    await supabase.from("onboarding_tasks").update({ status: "a_fazer" }).eq("id", candidate.id);
    await recordHistory(supabase, candidate.project_id, null, "task_unblocked", { task_title: candidate.title });
    await createMirrorIfNeeded(supabase, { ...candidate, status: "a_fazer" });
  }
}

// Chamado por PATCH /api/workspace/tasks/[id]/move quando a tarefa movida tem
// onboarding_task_id — propaga o novo status pro mestre e reavalia dependentes.
export async function handleMirrorStatusChange(
  supabase: Supabase,
  mirrorTaskId: string,
  newStatus: WorkspaceTaskStatus,
  actorProfileId: string | null,
): Promise<void> {
  const { data: mirror } = await supabase
    .from("workspace_tasks")
    .select("onboarding_task_id")
    .eq("id", mirrorTaskId)
    .maybeSingle();
  const onboardingTaskId = mirror?.onboarding_task_id;
  if (!onboardingTaskId) return;

  const newOnboardingStatus = REVERSE_MIRROR_STATUS_MAP[newStatus];
  const { data: task } = await supabase
    .from("onboarding_tasks")
    .select("id, project_id, title, status")
    .eq("id", onboardingTaskId)
    .maybeSingle();
  if (!task) return;

  await supabase
    .from("onboarding_tasks")
    .update({
      status:       newOnboardingStatus,
      completed_at: newOnboardingStatus === "concluido" ? new Date().toISOString() : null,
    })
    .eq("id", onboardingTaskId);

  await recordHistory(supabase, task.project_id, actorProfileId, "task_status_changed", {
    task_title: task.title,
    from:       task.status,
    to:         newOnboardingStatus,
  });

  if (newOnboardingStatus === "concluido") {
    await recordHistory(supabase, task.project_id, actorProfileId, "task_completed", { task_title: task.title });
    await unblockDependents(supabase, onboardingTaskId);
  }
}

// Chamado por PATCH /api/workspace/onboarding/tasks/[taskId]/move — mudança de
// status feita DENTRO do Onboarding (pelo admin ou pelo próprio responsável),
// não pelo Workspace pessoal. Direção oposta de handleMirrorStatusChange: aqui
// o mestre é quem manda, e o espelho é atualizado/criado/removido em seguida.
export async function handleOnboardingTaskStatusChange(
  supabase: Supabase,
  taskId: string,
  newStatus: OnboardingTaskStatus,
  actorProfileId: string | null,
): Promise<void> {
  const { data: task } = await supabase
    .from("onboarding_tasks")
    .select("*")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return;

  const { data: updated, error } = await supabase
    .from("onboarding_tasks")
    .update({
      status:       newStatus,
      completed_at: newStatus === "concluido" ? new Date().toISOString() : null,
    })
    .eq("id", taskId)
    .select("*")
    .single();
  if (error || !updated) return;

  await recordHistory(supabase, task.project_id, actorProfileId, "task_status_changed", {
    task_title: task.title,
    from:       task.status,
    to:         newStatus,
  });

  await applyOnboardingTaskEditToMirror(supabase, updated);

  if (newStatus === "concluido") {
    await recordHistory(supabase, task.project_id, actorProfileId, "task_completed", { task_title: task.title });
    await unblockDependents(supabase, taskId);
  }
}

// Chamado quando um admin edita uma onboarding_task (título/descrição/
// prioridade/prazo/responsável/status) — propaga pro espelho existente, ou
// cria/remove o espelho conforme o novo estado exigir.
export async function applyOnboardingTaskEditToMirror(supabase: Supabase, task: OnboardingTaskForMirror): Promise<void> {
  const mirrorStatus = MIRROR_STATUS_MAP[task.status];

  const { data: existing } = await supabase
    .from("workspace_tasks")
    .select("id, user_id")
    .eq("onboarding_task_id", task.id)
    .maybeSingle();

  if (!mirrorStatus) {
    if (existing) await removeMirrorForOnboardingTask(supabase, task.id);
    return;
  }

  if (!task.assignee_profile_id) {
    if (existing) await removeMirrorForOnboardingTask(supabase, task.id);
    return;
  }

  if (existing) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("auth_user_id")
      .eq("id", task.assignee_profile_id)
      .maybeSingle();

    if (profile?.auth_user_id && profile.auth_user_id !== existing.user_id) {
      // Reatribuído pra outra pessoa — o espelho antigo não faz mais sentido
      // na lista de quem já não é mais responsável; recria pro novo.
      await removeMirrorForOnboardingTask(supabase, task.id);
      await createMirrorIfNeeded(supabase, task);
      return;
    }

    await supabase
      .from("workspace_tasks")
      .update({
        title:       task.title,
        description: task.description,
        priority:    task.priority,
        due_date:    task.due_date,
        due_time:    task.due_time ?? null,
        status:      mirrorStatus,
      })
      .eq("id", existing.id);
    return;
  }

  await createMirrorIfNeeded(supabase, task);
}
