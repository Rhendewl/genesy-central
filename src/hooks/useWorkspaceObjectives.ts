"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type {
  WorkspaceObjective, NewWorkspaceObjective, UpdateWorkspaceObjective, WorkspaceObjectiveStep,
} from "@/types/workspace-objectives";

// ─────────────────────────────────────────────────────────────────────────────
// useWorkspaceObjectives — grade de objetivos (mesmo formato de useWorkspaceTasks.ts,
// mais simples: sem status/coluna/move — só progresso calculado das etapas).
// ─────────────────────────────────────────────────────────────────────────────

export function useWorkspaceObjectives() {
  const supabase = getSupabaseClient();

  const [objectives, setObjectives] = useState<WorkspaceObjective[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchObjectives = useCallback(async () => {
    setError(null);

    // Busca as etapas completas (não só a contagem) — objetivos têm poucas
    // etapas cada, então dá pra exibi-las direto no card sem query extra por card.
    const [objectivesRes, stepsRes] = await Promise.all([
      supabase.from("workspace_objectives").select("*").order("updated_at", { ascending: false }),
      supabase.from("workspace_objective_steps").select("*").order("position"),
    ]);

    if (!mountedRef.current) return;
    if (objectivesRes.error) { setError(objectivesRes.error.message); return; }

    const stepsByObjective = new Map<string, WorkspaceObjectiveStep[]>();
    for (const row of (stepsRes.data ?? []) as WorkspaceObjectiveStep[]) {
      const list = stepsByObjective.get(row.objective_id);
      if (list) list.push(row);
      else stepsByObjective.set(row.objective_id, [row]);
    }

    const enriched = ((objectivesRes.data as WorkspaceObjective[]) ?? []).map((o) => {
      const steps = stepsByObjective.get(o.id) ?? [];
      return {
        ...o,
        steps,
        steps_total: steps.length,
        steps_done:  steps.filter((s) => s.is_completed).length,
      };
    });

    setObjectives(enriched);
  }, [supabase]);

  useEffect(() => {
    mountedRef.current = true;
    setIsLoading(true);
    fetchObjectives().finally(() => { if (mountedRef.current) setIsLoading(false); });

    const channel = supabase
      .channel("workspace-objectives-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_objectives" }, () => fetchObjectives())
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_objective_steps" }, () => fetchObjectives())
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [fetchObjectives, supabase]);

  async function createObjective(data: NewWorkspaceObjective): Promise<{ error: string | null; objective: WorkspaceObjective | null }> {
    try {
      const res  = await fetch("/api/workspace/objectives", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data),
      });
      const json = await res.json() as { objective?: WorkspaceObjective; error?: string };
      if (!res.ok || !json.objective) return { error: json.error ?? "Erro ao criar objetivo", objective: null };

      setObjectives((prev) => [{ ...json.objective!, steps: [], steps_total: 0, steps_done: 0 }, ...prev]);
      return { error: null, objective: json.objective };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Erro ao criar objetivo", objective: null };
    }
  }

  async function updateObjective(id: string, data: UpdateWorkspaceObjective): Promise<{ error: string | null }> {
    const previous = objectives.find((o) => o.id === id);
    setObjectives((prev) => prev.map((o) => (o.id === id ? { ...o, ...data } : o)));

    try {
      const res = await fetch(`/api/workspace/objectives/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        if (previous) setObjectives((prev) => prev.map((o) => (o.id === id ? previous : o)));
        return { error: json.error ?? "Erro ao atualizar objetivo" };
      }
      return { error: null };
    } catch (err) {
      if (previous) setObjectives((prev) => prev.map((o) => (o.id === id ? previous : o)));
      return { error: err instanceof Error ? err.message : "Erro ao atualizar objetivo" };
    }
  }

  // Toggle rápido de etapa direto no card da grade (sem abrir o painel lateral).
  async function toggleObjectiveStep(objectiveId: string, stepId: string, isCompleted: boolean): Promise<{ error: string | null }> {
    const previous = objectives.find((o) => o.id === objectiveId);
    setObjectives((prev) => prev.map((o) => {
      if (o.id !== objectiveId) return o;
      const steps = (o.steps ?? []).map((s) => (s.id === stepId ? { ...s, is_completed: isCompleted } : s));
      return { ...o, steps, steps_done: steps.filter((s) => s.is_completed).length };
    }));

    try {
      const res = await fetch(`/api/workspace/objectives/${objectiveId}/steps/${stepId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ is_completed: isCompleted }),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        if (previous) setObjectives((prev) => prev.map((o) => (o.id === objectiveId ? previous : o)));
        return { error: json.error ?? "Erro ao atualizar etapa" };
      }
      return { error: null };
    } catch (err) {
      if (previous) setObjectives((prev) => prev.map((o) => (o.id === objectiveId ? previous : o)));
      return { error: err instanceof Error ? err.message : "Erro ao atualizar etapa" };
    }
  }

  async function deleteObjective(id: string): Promise<{ error: string | null }> {
    const previous = objectives.find((o) => o.id === id);
    setObjectives((prev) => prev.filter((o) => o.id !== id));

    try {
      const res = await fetch(`/api/workspace/objectives/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        if (previous) setObjectives((prev) => [...prev, previous]);
        return { error: json.error ?? "Erro ao excluir objetivo" };
      }
      return { error: null };
    } catch (err) {
      if (previous) setObjectives((prev) => [...prev, previous]);
      return { error: err instanceof Error ? err.message : "Erro ao excluir objetivo" };
    }
  }

  return { objectives, isLoading, error, createObjective, updateObjective, toggleObjectiveStep, deleteObjective, refetch: fetchObjectives };
}
