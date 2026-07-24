import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkspaceTaskCreatorAccess =
  | { allowed: true }
  | { allowed: false; status: 403 | 404; error: string };

export type WorkspaceTaskExecutorAccess = WorkspaceTaskCreatorAccess;

/**
 * Autoriza mutações de uma tarefa exclusivamente pelo usuário que a criou.
 * A consulta continua respeitando a RLS de leitura, portanto não revela tarefas
 * que o usuário não pode visualizar.
 */
export async function verifyWorkspaceTaskCreator(
  supabase: SupabaseClient,
  taskId: string,
  userId: string,
): Promise<WorkspaceTaskCreatorAccess> {
  const { data, error } = await supabase
    .from("workspace_tasks")
    .select("created_by")
    .eq("id", taskId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return { allowed: false, status: 404, error: "Tarefa não encontrada" };
  if (data.created_by !== userId) {
    return {
      allowed: false,
      status: 403,
      error: "Somente o criador da tarefa pode alterá-la",
    };
  }

  return { allowed: true };
}

/**
 * Autoriza as ações operacionais da tarefa (concluir/reabrir e marcar o
 * checklist) para o criador ou para um usuário explicitamente responsável.
 * Isso não concede acesso aos campos administrativos da tarefa.
 */
export async function verifyWorkspaceTaskExecutor(
  supabase: SupabaseClient,
  taskId: string,
  userId: string,
): Promise<WorkspaceTaskExecutorAccess> {
  const { data: task, error: taskError } = await supabase
    .from("workspace_tasks")
    .select("created_by")
    .eq("id", taskId)
    .maybeSingle();

  if (taskError) throw new Error(taskError.message);
  if (!task) return { allowed: false, status: 404, error: "Tarefa não encontrada" };
  if (task.created_by === userId) return { allowed: true };

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  if (!profile) {
    return { allowed: false, status: 403, error: "Você não é responsável por esta tarefa" };
  }

  const { data: assignment, error: assignmentError } = await supabase
    .from("workspace_task_assignees")
    .select("id")
    .eq("task_id", taskId)
    .eq("assignee_id", profile.id)
    .maybeSingle();

  if (assignmentError) throw new Error(assignmentError.message);
  if (!assignment) {
    return { allowed: false, status: 403, error: "Você não é responsável por esta tarefa" };
  }

  return { allowed: true };
}
