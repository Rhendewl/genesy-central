"use client";

import { useState, useCallback, useEffect } from "react";
import type { FormSubmission } from "@/types";

interface UseFormularioRespostasReturn {
  respostas: FormSubmission[];
  total: number;
  isLoading: boolean;
  error: string | null;
  page: number;
  setPage: (p: number) => void;
  refetch: () => Promise<void>;
}

export function useFormularioRespostas(formId: string, limit = 50): UseFormularioRespostasReturn {
  const [respostas, setRespostas] = useState<FormSubmission[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const refetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/formularios/${formId}/respostas?page=${page}&limit=${limit}`);
      if (!res.ok) throw new Error("Erro ao carregar respostas");
      const json = await res.json();
      setRespostas(json.respostas ?? []);
      setTotal(json.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setIsLoading(false);
    }
  }, [formId, page, limit]);

  useEffect(() => { refetch(); }, [refetch]);

  return { respostas, total, isLoading, error, page, setPage, refetch };
}
