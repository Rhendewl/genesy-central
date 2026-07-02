"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { Lead } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// useLeadsAnalyticsData
//
// Camada de obtenção de dados exclusiva da aba Leads Analytics.
// Intencionalmentte separada de useLeads para não acumular responsabilidades:
//
//   useLeads              → real-time, CRUD, optimistic updates, Kanban
//   useLeadsAnalyticsData → leitura filtrada por pipeline, sem real-time
//
// A filtragem acontece na origin (banco), não em memória:
//   pipelineIds === null       → todos os leads do usuário (sem filtro)
//   pipelineIds === string[]   → WHERE pipeline_id = ANY(pipelineIds)
//
// Não inclui real-time subscription — analytics é uma visão de relatório,
// não um board ao vivo. Usa refetch() para atualizar manualmente se necessário.
// ─────────────────────────────────────────────────────────────────────────────

export function useLeadsAnalyticsData(pipelineIds: string[] | null) {
  const supabase = getSupabaseClient();

  const [leads,     setLeads]     = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const mountedRef = useRef(true);

  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // Empty selection — guard against caller passing []; treat as null (all).
    const ids = pipelineIds !== null && pipelineIds.length === 0 ? null : pipelineIds;

    let query = supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (ids !== null) {
      query = query.in("pipeline_id", ids);
    }

    const { data, error: err } = await query;

    if (!mountedRef.current) return;

    if (err) {
      setError(err.message);
      setIsLoading(false);
      return;
    }

    const normalized = ((data as Lead[]) ?? []).map(l => ({
      ...l,
      deal_value: l.deal_value ?? 0,
    }));

    setLeads(normalized);
    setIsLoading(false);
  }, [supabase, pipelineIds]);

  useEffect(() => {
    mountedRef.current = true;
    fetchLeads();
    return () => { mountedRef.current = false; };
  }, [fetchLeads]);

  return { leads, isLoading, error, refetch: fetchLeads };
}
