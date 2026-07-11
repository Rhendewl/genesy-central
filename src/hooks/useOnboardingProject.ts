"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { NewOnboardingTask, OnboardingProjectDetail, UpdateOnboardingProject } from "@/types/onboarding";

// ─────────────────────────────────────────────────────────────────────────────
// useOnboardingProject — tela de detalhe de um onboarding (etapas → tarefas).
// Realtime escopado ao projeto (não ao usuário, diferente do resto do
// Workspace) — todo mundo com acesso ao projeto vê as mesmas mudanças.
// ─────────────────────────────────────────────────────────────────────────────

export function useOnboardingProject(projectId: string | null) {
  const supabase = getSupabaseClient();

  const [detail,    setDetail]    = useState<OnboardingProjectDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchDetail = useCallback(async () => {
    if (!projectId) return;
    setError(null);
    const res  = await fetch(`/api/workspace/onboarding/projects/${projectId}`);
    const json = await res.json() as { project?: OnboardingProjectDetail; error?: string };
    if (!mountedRef.current) return;
    if (!res.ok || !json.project) { setError(json.error ?? "Erro ao carregar onboarding"); return; }
    setDetail(json.project);
  }, [projectId]);

  useEffect(() => {
    mountedRef.current = true;
    if (!projectId) { setIsLoading(false); return; }
    setIsLoading(true);
    fetchDetail().finally(() => { if (mountedRef.current) setIsLoading(false); });

    const channel = supabase
      .channel(`onboarding-project-realtime-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "onboarding_projects", filter: `id=eq.${projectId}` }, () => fetchDetail())
      .on("postgres_changes", { event: "*", schema: "public", table: "onboarding_project_stages", filter: `project_id=eq.${projectId}` }, () => fetchDetail())
      .on("postgres_changes", { event: "*", schema: "public", table: "onboarding_tasks", filter: `project_id=eq.${projectId}` }, () => fetchDetail())
      .on("postgres_changes", { event: "*", schema: "public", table: "onboarding_task_dependencies" }, () => fetchDetail())
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [fetchDetail, supabase, projectId]);

  async function updateProject(patch: UpdateOnboardingProject) {
    if (!projectId) return { error: "Sem projeto" };
    const res  = await fetch(`/api/workspace/onboarding/projects/${projectId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
    const json = await res.json() as { error?: string };
    if (res.ok) await fetchDetail();
    return json;
  }

  async function addStage(data: { name: string; order_index?: number; due_date?: string | null; color?: string }) {
    if (!projectId) return { error: "Sem projeto" };
    const res  = await fetch(`/api/workspace/onboarding/projects/${projectId}/stages`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    const json = await res.json() as { error?: string };
    if (res.ok) await fetchDetail();
    return json;
  }

  async function addTask(data: NewOnboardingTask) {
    if (!projectId) return { error: "Sem projeto" };
    const res  = await fetch(`/api/workspace/onboarding/projects/${projectId}/tasks`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    const json = await res.json() as { error?: string };
    if (res.ok) await fetchDetail();
    return json;
  }

  return { detail, isLoading, error, refetch: fetchDetail, updateProject, addStage, addTask };
}
