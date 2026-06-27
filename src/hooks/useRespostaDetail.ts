"use client";

import { useState, useCallback, useEffect } from "react";
import type { SubmissionDetail } from "@/lib/respostas/types";

const CACHE_MAX = 30;

// Module-level LRU cache (Map preserves insertion order; oldest entry evicted at CACHE_MAX)
const detailCache = new Map<string, SubmissionDetail>();

function setCachedDetail(id: string, data: SubmissionDetail): void {
  if (detailCache.size >= CACHE_MAX) {
    const oldest = detailCache.keys().next().value as string | undefined;
    if (oldest) detailCache.delete(oldest);
  }
  detailCache.set(id, data);
}

export interface UseRespostaDetailReturn {
  detail:    SubmissionDetail | null;
  isLoading: boolean;
  error:     string | null;
  refresh:   () => void;
}

export function useRespostaDetail(id: string | null | undefined): UseRespostaDetailReturn {
  const cached = id ? (detailCache.get(id) ?? null) : null;

  const [detail,    setDetail]    = useState<SubmissionDetail | null>(cached);
  // Start loading immediately when id is provided and no cache hit
  const [isLoading, setIsLoading] = useState(() => !!id && !cached);
  const [error,     setError]     = useState<string | null>(null);
  const [rev,       setRev]       = useState(0);

  useEffect(() => {
    if (!id) {
      setDetail(null);
      return;
    }

    // Serve cached value immediately, then revalidate in background
    const hit = detailCache.get(id);
    if (hit) setDetail(hit);

    let cancelled = false;
    if (!hit) setIsLoading(true);

    fetch(`/api/respostas/${id}`)
      .then(r => {
        if (!r.ok) {
          return r.json().then(
            (body: unknown) => { throw new Error((body as { error?: string })?.error ?? `HTTP ${r.status}`); },
            ()              => { throw new Error(`HTTP ${r.status}`); },
          );
        }
        return r.json() as Promise<SubmissionDetail>;
      })
      .then(data => {
        if (cancelled) return;
        setCachedDetail(id, data);
        setDetail(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Erro ao carregar resposta");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [id, rev]);

  const refresh = useCallback(() => {
    if (id) detailCache.delete(id);
    setRev(r => r + 1);
  }, [id]);

  return { detail, isLoading, error, refresh };
}

// Exported for test reset
export function clearDetailCache(): void {
  detailCache.clear();
}
