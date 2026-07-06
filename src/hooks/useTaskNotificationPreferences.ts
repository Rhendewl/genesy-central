"use client";

import { useCallback, useEffect, useState } from "react";
import type { TaskNotificationPreferences, UpdateTaskNotificationPreferences } from "@/types/workspace-notifications";

export function useTaskNotificationPreferences() {
  const [preferences, setPreferences] = useState<TaskNotificationPreferences | null>(null);
  const [isLoading,   setIsLoading]   = useState(true);
  const [isSaving,    setIsSaving]    = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const fetchPreferences = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch("/api/workspace/notifications/preferences");
      const json = await res.json() as { preferences?: TaskNotificationPreferences; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Erro ao carregar preferências");
      setPreferences(json.preferences ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar preferências");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchPreferences(); }, [fetchPreferences]);

  async function save(patch: UpdateTaskNotificationPreferences): Promise<{ error: string | null }> {
    const previous = preferences;
    if (previous) setPreferences({ ...previous, ...patch });
    setIsSaving(true);

    try {
      const res = await fetch("/api/workspace/notifications/preferences", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(patch),
      });
      const json = await res.json() as { preferences?: TaskNotificationPreferences; error?: string };
      if (!res.ok) {
        if (previous) setPreferences(previous);
        return { error: json.error ?? "Erro ao salvar preferências" };
      }
      setPreferences(json.preferences ?? null);
      return { error: null };
    } catch (e) {
      if (previous) setPreferences(previous);
      return { error: e instanceof Error ? e.message : "Erro ao salvar preferências" };
    } finally {
      setIsSaving(false);
    }
  }

  return { preferences, isLoading, isSaving, error, save, refetch: fetchPreferences };
}
