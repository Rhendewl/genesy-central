"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { useCurrentMember } from "@/context/CurrentMemberContext";
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
  const { member } = useCurrentMember();

  const [tasks,     setTasks]     = useState<WorkspaceTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [completionCelebrationId, setCompletionCelebrationId] = useState<number | null>(null);

  const mountedRef = useRef(true);
  const discardedTaskIdsRef = useRef<Set<string>>(new Set());
  const celebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestFetchIdRef = useRef(0);

  const triggerCompletionCelebration = useCallback(() => {
    if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
    setCompletionCelebrationId(Date.now());
    celebrationTimerRef.current = setTimeout(() => setCompletionCelebrationId(null), 1350);
  }, []);

  useEffect(() => () => {
    if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
  }, []);

  const fetchTasks = useCallback(async () => {
    const fetchId = ++latestFetchIdRef.current;
    setError(null);

    const qs = viewAsUserId ? `?as_user_id=${viewAsUserId}` : "";
    const res  = await fetch(`/api/workspace/tasks${qs}`);
    const json = await res.json() as { tasks?: WorkspaceTask[]; error?: string };

    if (!mountedRef.current || fetchId !== latestFetchIdRef.current) return;
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

    if (!mountedRef.current || fetchId !== latestFetchIdRef.current) return;

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

    setTasks(enriched.filter((task) => !discardedTaskIdsRef.current.has(task.id)));
  }, [supabase, viewAsUserId]);

  const scheduleRealtimeRefresh = useCallback(() => {
    if (realtimeRefreshTimerRef.current) clearTimeout(realtimeRefreshTimerRef.current);
    realtimeRefreshTimerRef.current = setTimeout(() => {
      realtimeRefreshTimerRef.current = null;
      void fetchTasks();
    }, 180);
  }, [fetchTasks]);

  useEffect(() => {
    mountedRef.current = true;
    setIsLoading(true);

    fetchTasks().finally(() => {
      if (mountedRef.current) setIsLoading(false);
    });

    const channel = supabase
      .channel(`workspace-tasks-realtime-${viewAsUserId ?? "self"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_tasks" }, (payload) => {
        // O status precisa refletir no gráfico no mesmo instante em que o
        // evento realtime chega. A consulta completa continua rodando em
        // segundo plano para enriquecer responsáveis/checklist/comentários.
        // Invalidar uma consulta anterior também impede que uma resposta
        // lenta restaure temporariamente o estado antigo na tela.
        latestFetchIdRef.current += 1;

        if (payload.eventType === "UPDATE") {
          const changedTask = payload.new as Partial<WorkspaceTask> & { id?: string };
          if (changedTask.id) {
            setTasks((prev) => prev.map((task) => (
              task.id === changedTask.id ? { ...task, ...changedTask } : task
            )));
          }
        } else if (payload.eventType === "DELETE") {
          const deletedTask = payload.old as { id?: string };
          if (deletedTask.id) {
            setTasks((prev) => prev.filter((task) => task.id !== deletedTask.id));
          }
        }

        scheduleRealtimeRefresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_task_checklist_items" }, scheduleRealtimeRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_task_comments" }, scheduleRealtimeRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_task_assignees" }, scheduleRealtimeRefresh)
      .subscribe();

    return () => {
      mountedRef.current = false;
      latestFetchIdRef.current += 1;
      if (realtimeRefreshTimerRef.current) {
        clearTimeout(realtimeRefreshTimerRef.current);
        realtimeRefreshTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [fetchTasks, scheduleRealtimeRefresh, supabase, viewAsUserId]);

  const tasksByStatus: TasksByStatus = useMemo(() => {
    const acc: TasksByStatus = { a_fazer: [], em_andamento: [], aguardando: [], concluido: [] };
    for (const t of tasks) acc[t.status].push(t);
    return acc;
  }, [tasks]);

  const completionStats = useMemo(() => {
    const total = tasks.length;
    const completed = tasksByStatus.concluido.length;
    return {
      total,
      completed,
      percent: total > 0 ? (completed / total) * 100 : 0,
    };
  }, [tasks.length, tasksByStatus]);

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
    if (!canEditTask(previous)) {
      return { error: "Somente o criador da tarefa pode alterá-la" };
    }
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
    if (!canEditTask(previous)) {
      return { error: "Somente o criador da tarefa pode excluí-la" };
    }
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

  function discardTask(id: string): {
    error: string | null;
    discarded: { task: WorkspaceTask; index: number } | null;
  } {
    const index = tasks.findIndex((task) => task.id === id);
    const task = index >= 0 ? tasks[index] : null;
    if (!task || !canEditTask(task)) {
      return { error: "Somente o criador da tarefa pode descartá-la", discarded: null };
    }
    discardedTaskIdsRef.current.add(id);
    setTasks((prev) => prev.filter((item) => item.id !== id));
    return { error: null, discarded: { task, index } };
  }

  function restoreDiscardedTask(task: WorkspaceTask, index: number) {
    discardedTaskIdsRef.current.delete(task.id);
    setTasks((prev) => {
      if (prev.some((item) => item.id === task.id)) return prev;
      const insertionIndex = Math.max(0, Math.min(index, prev.length));
      return [...prev.slice(0, insertionIndex), task, ...prev.slice(insertionIndex)];
    });
  }

  async function commitDiscardedTask(task: WorkspaceTask, index: number): Promise<{ error: string | null }> {
    try {
      const res = await fetch(`/api/workspace/tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        discardedTaskIdsRef.current.delete(task.id);
        restoreDiscardedTask(task, index);
        return { error: json.error ?? "Erro ao descartar tarefa" };
      }
      discardedTaskIdsRef.current.delete(task.id);
      return { error: null };
    } catch (err) {
      discardedTaskIdsRef.current.delete(task.id);
      restoreDiscardedTask(task, index);
      return { error: err instanceof Error ? err.message : "Erro ao descartar tarefa" };
    }
  }

  function updateChecklistProgress(id: string, total: number, done: number) {
    setTasks((prev) => prev.map((task) => task.id === id ? {
      ...task,
      checklist_total: Math.max(0, total),
      checklist_done:  Math.max(0, Math.min(done, total)),
    } : task));
  }

  // ── Move (drag & drop) ─────────────────────────────────────────────────────
  // orderedIds: lista completa e ordenada de tarefas da coluna de destino
  // após o drop (a tarefa `id` deve estar incluída nela).

  async function moveTask(
    id: string,
    targetStatus: WorkspaceTaskStatus,
    orderedIds: string[],
  ): Promise<{ error: string | null }> {
    const task = tasks.find((item) => item.id === id);
    if (!task || !canExecuteTask(task)) {
      return { error: "Somente o criador ou um responsável pode mover esta tarefa" };
    }
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

    // A confirmação visual pertence à ação otimista do usuário e não deve
    // esperar toda a cadeia do servidor (espelho do onboarding, histórico e
    // notificações). Em caso de falha, o estado da tarefa ainda é revertido.
    if (task.status !== "concluido" && targetStatus === "concluido") {
      triggerCompletionCelebration();
    }

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

  async function toggleComplete(id: string): Promise<{ error: string | null }> {
    const task = tasks.find((t) => t.id === id);
    if (!task) return { error: "Tarefa não encontrada" };
    if (!canExecuteTask(task)) {
      return { error: "Somente o criador ou um responsável pode concluir esta tarefa" };
    }

    const previousTasks = tasks;
    const completed = task.status !== "concluido";
    const targetStatus: WorkspaceTaskStatus = completed ? "concluido" : "a_fazer";
    setTasks((prev) => prev.map((item) => item.id === id ? {
      ...item,
      status: targetStatus,
      completed_at: completed ? new Date().toISOString() : null,
    } : item));
    if (completed) triggerCompletionCelebration();

    try {
      const res = await fetch(`/api/workspace/tasks/${id}/completion`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        setTasks(previousTasks);
        return { error: json.error ?? "Erro ao atualizar conclusão" };
      }
      return { error: null };
    } catch (err) {
      setTasks(previousTasks);
      return { error: err instanceof Error ? err.message : "Erro ao atualizar conclusão" };
    }
  }

  function getTaskById(id: string): WorkspaceTask | undefined {
    return tasks.find((t) => t.id === id);
  }

  function canEditTask(task: WorkspaceTask | undefined | null): boolean {
    if (!task) return false;
    // A API calcula esta permissão usando a sessão autenticada, sem depender
    // do perfil de equipe ter terminado de carregar no cliente. O fallback
    // mantém compatibilidade com objetos otimistas/antigos sem `can_edit`.
    return task.can_edit ?? (!!member?.auth_user_id && task.created_by === member.auth_user_id);
  }

  function canExecuteTask(task: WorkspaceTask | undefined | null): boolean {
    if (!task) return false;
    // `can_edit` vem calculado pela API e continua funcionando mesmo durante
    // o carregamento do perfil local. Responsáveis podem executar/mover, sem
    // ganhar permissão para editar os campos administrativos da tarefa.
    return canEditTask(task) || (!!member && task.assignee_ids.includes(member.id));
  }

  return {
    tasks,
    tasksByStatus,
    completionStats,
    isLoading,
    error,
    createTask,
    updateTask,
    deleteTask,
    discardTask,
    restoreDiscardedTask,
    commitDiscardedTask,
    updateChecklistProgress,
    moveTask,
    toggleComplete,
    getTaskById,
    canEditTask,
    canExecuteTask,
    completionCelebrationId,
    refetch: fetchTasks,
  };
}
