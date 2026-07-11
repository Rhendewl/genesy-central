"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { NewOnboardingTemplate, OnboardingTemplate } from "@/types/onboarding";

// ─────────────────────────────────────────────────────────────────────────────
// useOnboardingTemplates — lista de templates (admin-only, RLS já restringe).
// Mesmo formato de useWorkspaceNoteFolders.ts: fetch via API route, realtime
// em todas as tabelas que afetam a contagem exibida na listagem.
// ─────────────────────────────────────────────────────────────────────────────

export function useOnboardingTemplates() {
  const supabase = getSupabaseClient();

  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchTemplates = useCallback(async () => {
    setError(null);
    const res  = await fetch("/api/workspace/onboarding/templates");
    const json = await res.json() as { templates?: OnboardingTemplate[]; error?: string };

    if (!mountedRef.current) return;
    if (!res.ok || !json.templates) { setError(json.error ?? "Erro ao carregar templates"); return; }
    setTemplates(json.templates);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    setIsLoading(true);
    fetchTemplates().finally(() => { if (mountedRef.current) setIsLoading(false); });

    const channel = supabase
      .channel("onboarding-templates-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "onboarding_templates" }, () => fetchTemplates())
      .on("postgres_changes", { event: "*", schema: "public", table: "onboarding_template_stages" }, () => fetchTemplates())
      .on("postgres_changes", { event: "*", schema: "public", table: "onboarding_template_tasks" }, () => fetchTemplates())
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [fetchTemplates, supabase]);

  async function createTemplate(data: NewOnboardingTemplate): Promise<{ error: string | null; template: OnboardingTemplate | null }> {
    try {
      const res  = await fetch("/api/workspace/onboarding/templates", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data),
      });
      const json = await res.json() as { template?: OnboardingTemplate; error?: string };
      if (!res.ok || !json.template) return { error: json.error ?? "Erro ao criar template", template: null };

      setTemplates((prev) => [json.template!, ...prev]);
      return { error: null, template: json.template };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Erro ao criar template", template: null };
    }
  }

  async function deleteTemplate(id: string): Promise<{ error: string | null }> {
    const previous = templates.find((t) => t.id === id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));

    try {
      const res = await fetch(`/api/workspace/onboarding/templates/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        if (previous) setTemplates((prev) => [...prev, previous]);
        return { error: json.error ?? "Erro ao excluir template" };
      }
      return { error: null };
    } catch (err) {
      if (previous) setTemplates((prev) => [...prev, previous]);
      return { error: err instanceof Error ? err.message : "Erro ao excluir template" };
    }
  }

  return { templates, isLoading, error, createTemplate, deleteTemplate, refetch: fetchTemplates };
}
