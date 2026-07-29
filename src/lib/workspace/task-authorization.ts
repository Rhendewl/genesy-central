import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkspaceTaskEditorAccess =
  | { allowed: true }
  | { allowed: false; status: 403 | 404; error: string };

export type WorkspaceTaskExecutorAccess = WorkspaceTaskEditorAccess;

interface WorkspaceTaskOwnership {
  created_by: string;
  user_id: string;
}

export function hasWorkspaceTaskEditPermission(
  task: WorkspaceTaskOwnership,
  userId: string,
  isAdminOfWorkspace: boolean,
) {
  return task.created_by === userId || isAdminOfWorkspace;
}

export async function isWorkspaceAdminOfUser(
  supabase: SupabaseClient,
  targetUserId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_admin_of_user", {
    target_user_id: targetUserId,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

/**
 * Autoriza mutações administrativas pelo criador ou por um administrador
 * ativo da mesma organização.
 * A consulta continua respeitando a RLS de leitura, portanto não revela tarefas
 * que o usuário não pode visualizar.
 */
export async function verifyWorkspaceTaskEditor(
  supabase: SupabaseClient,
  taskId: string,
  userId: string,
): Promise<WorkspaceTaskEditorAccess> {
  const { data, error } = await supabase
    .from("workspace_tasks")
    .select("created_by, user_id")
    .eq("id", taskId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return { allowed: false, status: 404, error: "Tarefa não encontrada" };
  if (data.created_by === userId) return { allowed: true };

  const isAdmin = await isWorkspaceAdminOfUser(supabase, data.user_id);
  if (!hasWorkspaceTaskEditPermission(data, userId, isAdmin)) {
    return {
      allowed: false,
      status: 403,
      error: "Somente o criador ou um administrador pode alterar esta tarefa",
    };
  }

  return { allowed: true };
}

/**
 * Autoriza ações operacionais (concluir/reabrir e marcar checklist) para
 * criador, administrador ou usuário explicitamente responsável.
 */
export async function verifyWorkspaceTaskExecutor(
  supabase: SupabaseClient,
  taskId: string,
  userId: string,
): Promise<WorkspaceTaskExecutorAccess> {
  const { data: task, error: taskError } = await supabase
    .from("workspace_tasks")
    .select("created_by, user_id")
    .eq("id", taskId)
    .maybeSingle();

  if (taskError) throw new Error(taskError.message);
  if (!task) return { allowed: false, status: 404, error: "Tarefa não encontrada" };
  if (task.created_by === userId) return { allowed: true };
  if (await isWorkspaceAdminOfUser(supabase, task.user_id)) return { allowed: true };

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
