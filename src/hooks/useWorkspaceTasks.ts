"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type {
  WorkspaceTask, NewWorkspaceTask, UpdateWorkspaceTask, WorkspaceTaskStatus,
} from "@/types/workspace";

// ─────────────────────────────────────────────────────────────────────────────
// useWorkspaceTasks
//
//  - Busca as tarefas do Workspace de `viewAsUserId` (padrão: o próprio
//    usuário logado) sempre via GET /api/workspace/tasks — nunca faz um
//    select() sem filtro de user_id direto no client. Isso importa desde a
//    Fase 2: um admin tem acesso ampliado via RLS (is_admin_of_user) a
//    qualquer colega da equipe, então uma query sem filtro explícito
//    misturaria as tarefas de todo mundo no "Meu Workspace" do admin.
//  - Agrupa por status (para o Kanban) — mesmos dados servem a To-do List
//  - CRUD: createTask, updateTask, deleteTask
//  - moveTask: chama PATCH /api/workspace/tasks/[id]/move (nunca escreve
//    status/position diretamente) — otimista, com revert em erro
//  - toggleComplete: atalho de moveTask para status "concluido", usado pelo
//    checkbox da To-do List — como passa pela mesma rota/realtime do Kanban,
//    a mudança aparece instantaneamente nos dois lugares
//  - Realtime: qualquer mudança na tabela reflete imediatamente em todas as
//    visualizações abertas (Kanban, Lista, e futuramente Dashboard/Objetivos)
// ─────────────────────────────────────────────────────────────────────────────

export type TasksByStatus = Record<WorkspaceTaskStatus, WorkspaceTask[]>;

export function useWorkspaceTasks(viewAsUserId?: string) {
  const supabase = getSupabaseClient();

  const [tasks,     setTasks]     = useState<WorkspaceTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const mountedRef = useRef(true);

  const fetchTasks = useCallback(async () => {
    setError(null);

    const qs = viewAsUserId ? `?as_user_id=${viewAsUserId}` : "";
    const res  = await fetch(`/api/workspace/tasks${qs}`);
    const json = await res.json() as { tasks?: WorkspaceTask[]; error?: string };

    if (!mountedRef.current) return;
    if (!res.ok || !json.tasks) {
      setError(json.error ?? "Erro ao carregar tarefas");
      return;
    }

    const taskIds = json.tasks.map((t) => t.id);
    const [checklistRes, commentsRes] = taskIds.length > 0
      ? await Promise.all([
          supabase.from("workspace_task_checklist_items").select("task_id,is_completed").in("task_id", taskIds),
          supabase.from("workspace_task_comments").select("task_id").in("task_id", taskIds),
        ])
      : [{ data: [] as { task_id: string; is_completed: boolean }[] }, { data: [] as { task_id: string }[] }];

    if (!mountedRef.current) return;

    const checklistCounts = new Map<string, { total: number; done: number }>();
    for (const row of checklistRes.data ?? []) {
      const cur = checklistCounts.get(row.task_id) ?? { total: 0, done: 0 };
      cur.total += 1;
      if (row.is_completed) cur.done += 1;
      checklistCounts.set(row.task_id, cur);
    }

    const commentCounts = new Map<string, number>();
    for (const row of commentsRes.data ?? []) {
      commentCounts.set(row.task_id, (commentCounts.get(row.task_id) ?? 0) + 1);
    }

    const enriched = json.tasks.map((t) => ({
      ...t,
      checklist_total: checklistCounts.get(t.id)?.total ?? 0,
      checklist_done:  checklistCounts.get(t.id)?.done  ?? 0,
      comment_count:   commentCounts.get(t.id) ?? 0,
    }));

    setTasks(enriched);
  }, [supabase, viewAsUserId]);

  useEffect(() => {
    mountedRef.current = true;
    setIsLoading(true);

    fetchTasks().finally(() => {
      if (mountedRef.current) setIsLoading(false);
    });

    const channel = supabase
      .channel(`workspace-tasks-realtime-${viewAsUserId ?? "self"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_tasks" }, () => fetchTasks())
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_task_checklist_items" }, () => fetchTasks())
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_task_comments" }, () => fetchTasks())
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_task_assignees" }, () => fetchTasks())
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [fetchTasks, supabase, viewAsUserId]);

  const tasksByStatus: TasksByStatus = useMemo(() => {
    const acc: TasksByStatus = { a_fazer: [], em_andamento: [], aguardando: [], concluido: [] };
    for (const t of tasks) acc[t.status].push(t);
    return acc;
  }, [tasks]);

  async function createTask(data: NewWorkspaceTask): Promise<{ error: string | null; task: WorkspaceTask | null }> {
    try {
      const res = await fetch("/api/workspace/tasks", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(viewAsUserId ? { ...data, user_id: viewAsUserId } : data),
      });
      const json = await res.json() as { task?: WorkspaceTask; error?: string };
      if (!res.ok || !json.task) return { error: json.error ?? "Erro ao criar tarefa", task: null };

      setTasks((prev) => [...prev, {
        ...json.task!,
        assignee_ids:    json.task!.assignee_ids ?? [],
        checklist_total: 0,
        checklist_done:  0,
        comment_count:   0,
      }]);
      return { error: null, task: json.task };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Erro ao criar tarefa", task: null };
    }
  }

  async function updateTask(id: string, data: UpdateWorkspaceTask): Promise<{ error: string | null }> {
    const previous = tasks.find((t) => t.id === id);
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));

    try {
      const res = await fetch(`/api/workspace/tasks/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        if (previous) setTasks((prev) => prev.map((t) => (t.id === id ? previous : t)));
        return { error: json.error ?? "Erro ao atualizar tarefa" };
      }
      return { error: null };
    } catch (err) {
      if (previous) setTasks((prev) => prev.map((t) => (t.id === id ? previous : t)));
      return { error: err instanceof Error ? err.message : "Erro ao atualizar tarefa" };
    }
  }

  async function deleteTask(id: string): Promise<{ error: string | null }> {
    const previous = tasks.find((t) => t.id === id);
    setTasks((prev) => prev.filter((t) => t.id !== id));

    try {
      const res = await fetch(`/api/workspace/tasks/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        if (previous) setTasks((prev) => [...prev, previous]);
        return { error: json.error ?? "Erro ao excluir tarefa" };
      }
      return { error: null };
    } catch (err) {
      if (previous) setTasks((prev) => [...prev, previous]);
      return { error: err instanceof Error ? err.message : "Erro ao excluir tarefa" };
    }
  }

  // ── Move (drag & drop) ─────────────────────────────────────────────────────
  // orderedIds: lista completa e ordenada de tarefas da coluna de destino
  // após o drop (a tarefa `id` deve estar incluída nela).

  async function moveTask(
    id: string,
    targetStatus: WorkspaceTaskStatus,
    orderedIds: string[],
  ): Promise<{ error: string | null }> {
    const previousTasks = tasks;

    // Optimistic: aplica status + reindexa posição das tarefas da coluna afetada
    setTasks((prev) => {
      const next = prev.map((t) => (t.id === id ? {
        ...t,
        status:       targetStatus,
        completed_at: targetStatus === "concluido" ? new Date().toISOString() : null,
      } : t));
      orderedIds.forEach((taskId, idx) => {
        const idxInNext = next.findIndex((t) => t.id === taskId);
        if (idxInNext !== -1) next[idxInNext] = { ...next[idxInNext], position: idx * 10 };
      });
      return next;
    });

    try {
      const res = await fetch(`/api/workspace/tasks/${id}/move`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: targetStatus, ordered_ids: orderedIds }),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        setTasks(previousTasks);
        return { error: json.error ?? "Erro ao mover tarefa" };
      }
      return { error: null };
    } catch (err) {
      setTasks(previousTasks);
      return { error: err instanceof Error ? err.message : "Erro ao mover tarefa" };
    }
  }

  function toggleComplete(id: string): Promise<{ error: string | null }> {
    const task = tasks.find((t) => t.id === id);
    if (!task) return Promise.resolve({ error: "Tarefa não encontrada" });

    if (task.status === "concluido") {
      const column = tasksByStatus.a_fazer.map((t) => t.id);
      return moveTask(id, "a_fazer", [id, ...column]);
    }
    const column = tasksByStatus.concluido.map((t) => t.id);
    return moveTask(id, "concluido", [...column, id]);
  }

  function getTaskById(id: string): WorkspaceTask | undefined {
    return tasks.find((t) => t.id === id);
  }

  return {
    tasks,
    tasksByStatus,
    isLoading,
    error,
    createTask,
    updateTask,
    deleteTask,
    moveTask,
    toggleComplete,
    getTaskById,
    refetch: fetchTasks,
  };
}
