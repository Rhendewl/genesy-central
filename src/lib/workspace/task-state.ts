import type { WorkspaceTask } from "@/types/workspace";

export const COMPLETED_TASK_RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * Tarefas concluídas permanecem no quadro por 24 horas. Depois disso o cron
 * as exclui; este filtro evita que o intervalo entre ticks ainda polua a UI e
 * os indicadores de tarefas ativas.
 */
export function shouldKeepWorkspaceTask(task: WorkspaceTask, now = new Date()): boolean {
  if (task.status !== "concluido") return true;

  const completedAt = task.completed_at ?? task.updated_at ?? task.created_at;
  const completedAtMs = Date.parse(completedAt);
  if (!Number.isFinite(completedAtMs)) return false;

  return now.getTime() - completedAtMs < COMPLETED_TASK_RETENTION_MS;
}

/**
 * Insere ou substitui uma tarefa pelo ID.
 *
 * O INSERT chega pelo Realtime antes de o POST terminar quando a API ainda
 * está enviando notificações. O retorno do POST não pode anexar o mesmo ID uma
 * segunda vez ao estado que já foi atualizado pelo Realtime.
 */
export function upsertWorkspaceTask(
  tasks: WorkspaceTask[],
  task: WorkspaceTask,
): WorkspaceTask[] {
  const existingIndex = tasks.findIndex((item) => item.id === task.id);
  if (existingIndex === -1) return [...tasks, task];

  return tasks.map((item, index) => (
    index === existingIndex ? { ...item, ...task } : item
  ));
}

export function uniqueWorkspaceTasks(tasks: WorkspaceTask[]): WorkspaceTask[] {
  const seen = new Set<string>();
  return tasks.filter((task) => {
    if (seen.has(task.id)) return false;
    seen.add(task.id);
    return true;
  });
}
