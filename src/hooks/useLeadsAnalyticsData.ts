"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { dedupeCanonicalLeads } from "@/lib/crm/lead-identity";
import type { Lead } from "@/types";

// Linha de histórico de movimentação — usada só para as métricas de tempo
// de IE (tempo até IE 100 / tempo entre faixas de evolução). Espelha
// crm_lead_stage_history; ver useLeadsAnalytics.ts pelo cálculo.
export interface StageHistoryRow {
  lead_id:     string;
  stage_id:    string;
  pipeline_id: string;
  moved_at:    string;
}

// Linha mínima de crm_stages — só o necessário pra reconstruir o IE
// histórico de cada movimento (LeadScoreEngine.calculateIE precisa de
// order_index + total de etapas ativas da pipeline naquele momento).
export interface StageOrderRow {
  id:          string;
  pipeline_id: string;
  order_index: number;
  is_active:   boolean;
}

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

  const [leads,        setLeads]        = useState<Lead[]>([]);
  const [stageHistory, setStageHistory] = useState<StageHistoryRow[]>([]);
  const [stages,       setStages]       = useState<StageOrderRow[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  const mountedRef = useRef(true);

  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // [] é usado para um colaborador que ainda não recebeu pipeline: não deve
    // cair no comportamento de "todas" e expor dados por engano.
    if (pipelineIds !== null && pipelineIds.length === 0) {
      if (mountedRef.current) {
        setLeads([]);
        setStageHistory([]);
        setStages([]);
        setIsLoading(false);
      }
      return;
    }

    const ids = pipelineIds;

    let query = supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (ids !== null) {
      query = query.in("pipeline_id", ids);
    }

    // Histórico de movimentação + posição das etapas — só usados para as
    // métricas de tempo do IE (tempo até 100 / tempo entre faixas). Não têm
    // filtro de pipeline: são poucas linhas por lead, mais simples buscar
    // tudo do usuário do que replicar o filtro em duas queries relacionadas.
    const [{ data, error: err }, { data: historyData }, { data: stagesData }] = await Promise.all([
      query,
      supabase.from("crm_lead_stage_history").select("lead_id, stage_id, pipeline_id, moved_at").order("moved_at", { ascending: true }),
      supabase.from("crm_stages").select("id, pipeline_id, order_index, is_active"),
    ]);

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

    // Dentro de uma pipeline cada card operacional deve aparecer. Em visões
    // globais (ou que combinam pipelines), o mesmo lead é contado uma só vez.
    setLeads(ids === null || ids.length > 1 ? dedupeCanonicalLeads(normalized) : normalized);
    setStageHistory((historyData as StageHistoryRow[]) ?? []);
    setStages((stagesData as StageOrderRow[]) ?? []);
    setIsLoading(false);
  }, [supabase, pipelineIds]);

  useEffect(() => {
    mountedRef.current = true;
    fetchLeads();
    return () => { mountedRef.current = false; };
  }, [fetchLeads]);

  // Exclusão em lote — usada pela seleção múltipla na tabela de leads.
  // Uma única query (.in) em vez de N chamadas; RLS continua valendo por
  // linha. O Kanban (useLeads, com real-time) reflete a remoção sozinho via
  // sua própria subscription de DELETE — não precisa de coordenação aqui.
  const bulkDeleteLeads = useCallback(async (ids: string[]): Promise<{ error: string | null }> => {
    if (ids.length === 0) return { error: null };
    const { error: err } = await supabase.from("leads").delete().in("id", ids);
    if (err) return { error: err.message };
    setLeads(prev => prev.filter(l => !ids.includes(l.id)));
    return { error: null };
  }, [supabase]);

  return { leads, stageHistory, stages, isLoading, error, refetch: fetchLeads, bulkDeleteLeads };
}
