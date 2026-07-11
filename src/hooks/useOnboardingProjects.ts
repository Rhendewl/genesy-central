"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { NewOnboardingProject, OnboardingProject, OnboardingProjectSummary } from "@/types/onboarding";

// ─────────────────────────────────────────────────────────────────────────────
// useOnboardingProjects — dashboard de onboardings. Progresso/status/contagens
// vêm já agregados do servidor (uma query por card seria N+1) — ver GET
// /api/workspace/onboarding/projects.
// ─────────────────────────────────────────────────────────────────────────────

export function useOnboardingProjects(opts?: { search?: string; mine?: boolean }) {
  const supabase = getSupabaseClient();
  const search = opts?.search ?? "";
  const mine   = opts?.mine ?? false;

  const [projects,  setProjects]  = useState<OnboardingProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchProjects = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (mine)   params.set("mine", "1");
    const qs = params.toString() ? `?${params.toString()}` : "";

    const res  = await fetch(`/api/workspace/onboarding/projects${qs}`);
    const json = await res.json() as { projects?: OnboardingProjectSummary[]; error?: string };

    if (!mountedRef.current) return;
    if (!res.ok || !json.projects) { setError(json.error ?? "Erro ao carregar onboardings"); return; }
    setProjects(json.projects);
  }, [search, mine]);

  useEffect(() => {
    mountedRef.current = true;
    setIsLoading(true);
    fetchProjects().finally(() => { if (mountedRef.current) setIsLoading(false); });

    const channel = supabase
      .channel("onboarding-dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "onboarding_projects" }, () => fetchProjects())
      .on("postgres_changes", { event: "*", schema: "public", table: "onboarding_tasks" }, () => fetchProjects())
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [fetchProjects, supabase]);

  async function createProject(data: NewOnboardingProject): Promise<{ error: string | null; project: OnboardingProject | null }> {
    try {
      const res  = await fetch("/api/workspace/onboarding/projects", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data),
      });
      const json = await res.json() as { project?: OnboardingProject; error?: string };
      if (!res.ok || !json.project) return { error: json.error ?? "Erro ao criar onboarding", project: null };

      await fetchProjects();
      return { error: null, project: json.project };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Erro ao criar onboarding", project: null };
    }
  }

  return { projects, isLoading, error, createProject, refetch: fetchProjects };
}
