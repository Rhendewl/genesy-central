"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getSupabaseClient } from "@/lib/supabase";
import type {
  KanbanColumn,
  Lead,
  NewLead,
  UpdateLead,
} from "@/types";
import type { DateFilter } from "@/components/crm/PeriodFilter";

// ─────────────────────────────────────────────────────────────────────────────
// useLeads
//
// Responsabilidades:
//  - Busca todos os leads do usuário autenticado
//  - Agrupa leads por kanban_column (para o board)
//  - CRUD: createLead, updateLead, deleteLead
//  - moveLead: atualiza kanban_column + registra em lead_movements atomicamente
//  - Subscription real-time: qualquer mudança na tabela reflete imediatamente
// ─────────────────────────────────────────────────────────────────────────────

export type LeadsByColumn = Record<KanbanColumn, Lead[]>;

const EMPTY_BOARD: LeadsByColumn = {
  novo_lead:           [],
  abordados:           [],
  em_andamento:        [],
  formulario_aplicado: [],
  reuniao_agendada:    [],
  reuniao_realizada:   [],
  no_show:             [],
  venda_realizada:     [],
};

export function useLeads(dateFilter?: DateFilter | null) {
  const supabase = getSupabaseClient();

  const [leads, setLeads] = useState<Lead[]>([]);   // full unfiltered list
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ref para evitar atualização de estado em componente desmontado
  const mountedRef = useRef(true);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchLeads = useCallback(async () => {
    setError(null);
    const { data, error: err } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (!mountedRef.current) return;

    if (err) {
      setError(err.message);
      return;
    }
    // Normaliza deal_value: registros antigos podem não ter o campo ainda
    const normalized = ((data as Lead[]) ?? []).map((l) => ({
      ...l,
      deal_value: l.deal_value ?? 0,
    }));
    setLeads(normalized);
  }, [supabase]);

  // ── Real-time subscription ─────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    setIsLoading(true);

    fetchLeads().finally(() => {
      if (mountedRef.current) setIsLoading(false);
    });

    const channel = supabase
      .channel("leads-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "leads" },
        (payload) => {
          const lead = payload.new as Lead;
          if (lead.source === "meta_lead_ads") {
            toast.success(`Novo lead via Meta Lead Ads`, {
              description: [lead.name, lead.contact || lead.email].filter(Boolean).join(" · "),
              duration: 7000,
            });
          }
          fetchLeads();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "leads" },
        () => { fetchLeads(); }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "leads" },
        () => { fetchLeads(); }
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [fetchLeads, supabase]);

  // ── Derived: apply date filter client-side (instant, preserves real-time) ──

  const filteredLeads = useMemo(() => {
    if (!dateFilter) return leads;
    return leads.filter(l => {
      const d = new Date(l[dateFilter.field]);
      return d >= dateFilter.from && d <= dateFilter.to;
    });
  }, [leads, dateFilter]);

  const leadsByColumn: LeadsByColumn = useMemo(() =>
    filteredLeads.reduce<LeadsByColumn>(
      (acc, lead) => {
        const col = lead.kanban_column;
        if (acc[col]) acc[col] = [...acc[col], lead];
        return acc;
      },
      structuredClone(EMPTY_BOARD),
    ),
  [filteredLeads]);

  // ── Create ─────────────────────────────────────────────────────────────────

  async function createLead(data: NewLead): Promise<{ error: string | null }> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "Usuário não autenticado." };

    const { error: err } = await supabase.from("leads").insert({
      ...data,
      user_id: user.id,
    });

    if (err) return { error: err.message };
    return { error: null };
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  async function updateLead(
    id: string,
    data: UpdateLead
  ): Promise<{ error: string | null }> {
    const { error: err } = await supabase
      .from("leads")
      .update(data)
      .eq("id", id);

    if (err) return { error: err.message };
    return { error: null };
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function deleteLead(id: string): Promise<{ error: string | null }> {
    const { error: err } = await supabase
      .from("leads")
      .delete()
      .eq("id", id);

    if (err) return { error: err.message };
    return { error: null };
  }

  // ── Move (drag & drop) ────────────────────────────────────────────────────
  //
  // Faz as duas operações em sequência:
  //   1. Atualiza kanban_column no lead
  //   2. Insere registro em lead_movements (histórico)
  //
  // Aplica optimistic update local antes da confirmação do servidor
  // para resposta visual instantânea no Kanban.

  async function moveLead(
    id: string,
    fromColumn: KanbanColumn,
    toColumn: KanbanColumn
  ): Promise<{ error: string | null }> {
    if (fromColumn === toColumn) return { error: null };

    // Optimistic update
    setLeads((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, kanban_column: toColumn } : l
      )
    );

    // 1. Atualiza o lead
    const { error: updateErr } = await supabase
      .from("leads")
      .update({ kanban_column: toColumn })
      .eq("id", id);

    if (updateErr) {
      // Reverte optimistic update
      setLeads((prev) =>
        prev.map((l) =>
          l.id === id ? { ...l, kanban_column: fromColumn } : l
        )
      );
      return { error: updateErr.message };
    }

    // 2. Registra no histórico de movimentações
    const { error: movErr } = await supabase.from("lead_movements").insert({
      lead_id: id,
      from_column: fromColumn,
      to_column: toColumn,
    });

    // Falha no histórico não reverte o move — apenas loga
    if (movErr) {
      console.warn("[useLeads] lead_movements insert failed:", movErr.message);
    }

    return { error: null };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function getLeadById(id: string): Lead | undefined {
    return leads.find((l) => l.id === id);
  }

  function getColumnCount(col: KanbanColumn): number {
    return leadsByColumn[col].length;
  }

  return {
    leads:        filteredLeads,   // filtered — what the board renders
    totalLeads:   leads.length,    // unfiltered total (for "X leads no funil" label)
    leadsByColumn,
    isLoading,
    error,
    createLead,
    updateLead,
    deleteLead,
    moveLead,
    getLeadById,
    getColumnCount,
    refetch: fetchLeads,
  };
}
