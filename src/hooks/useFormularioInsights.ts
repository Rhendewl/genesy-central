"use client";

import { useState, useCallback, useEffect } from "react";
import type { FormInsights } from "@/types";

interface UseFormularioInsightsReturn {
  insights: FormInsights | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFormularioInsights(formId: string): UseFormularioInsightsReturn {
  const [insights, setInsights] = useState<FormInsights | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/formularios/${formId}/insights`);
      if (!res.ok) throw new Error("Erro ao carregar insights");
      const json = await res.json();
      setInsights(json.insights);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setIsLoading(false);
    }
  }, [formId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { insights, isLoading, error, refetch };
}
