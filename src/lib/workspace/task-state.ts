import type { WorkspaceTask } from "@/types/workspace";

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
