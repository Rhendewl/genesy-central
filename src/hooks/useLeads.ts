"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getSupabaseClient } from "@/lib/supabase";
import type {
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
//  - Agrupa leads por stage_id (para o board Kanban)
//  - CRUD: createLead, updateLead, deleteLead
//  - moveLead: chama PATCH /api/crm/leads/[id]/move → LeadService → RPC
//    Nenhuma escrita direta ao Supabase para movimentação de leads.
//  - Subscription real-time: qualquer mudança na tabela reflete imediatamente
// ─────────────────────────────────────────────────────────────────────────────

// Leads sem stage_id (legados ou criados via webhook) agrupados nesta chave
export const UNASSIGNED_STAGE_KEY = "__unassigned__" as const;

export type LeadsByStage = Record<string, Lead[]>;

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

  const leadsByStage: LeadsByStage = useMemo(() =>
    filteredLeads.reduce<LeadsByStage>(
      (acc, lead) => {
        const key = lead.stage_id ?? UNASSIGNED_STAGE_KEY;
        if (!acc[key]) acc[key] = [];
        acc[key].push(lead);
        return acc;
      },
      {},
    ),
  [filteredLeads]);

  // ── Create ─────────────────────────────────────────────────────────────────

  async function createLead(data: NewLead): Promise<{ error: string | null }> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "Usuário não autenticado." };

    const { data: created, error: err } = await supabase
      .from("leads")
      .insert({ ...data, user_id: user.id })
      .select()
      .single();

    if (err) return { error: err.message };

    // Optimistic: adiciona ao estado local imediatamente sem esperar real-time
    setLeads((prev) => [{ ...created, deal_value: created.deal_value ?? 0 }, ...prev]);
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
    // Optimistic: remove do estado local imediatamente
    const previous = leads.find((l) => l.id === id);
    setLeads((prev) => prev.filter((l) => l.id !== id));

    const { error: err } = await supabase
      .from("leads")
      .delete()
      .eq("id", id);

    if (err) {
      // Reverte se o servidor retornar erro
      if (previous) setLeads((prev) => [...prev, previous]);
      return { error: err.message };
    }
    return { error: null };
  }

  // ── Move (drag & drop) ─────────────────────────────────────────────────────
  //
  // Toda movimentação passa obrigatoriamente por:
  //   PATCH /api/crm/leads/[id]/move
  //     → LeadService.moveLead()
  //       → PipelineRepository.findStageById() (valida stage + require_note)
  //       → LeadRepository.moveLeadTransactional() (RPC crm_move_lead)
  //       → EventBus.publish(lead.stage.left + lead.stage.entered)
  //         → ConversionEngine
  //
  // Optimistic update: stage_id muda localmente antes da confirmação do servidor.
  // Reverte automaticamente se o servidor rejeitar (incluindo 422 require_note).
  // A subscription real-time sincroniza kanban_column e outros campos pós-RPC.

  async function moveLead(
    id: string,
    targetStageId: string,
    note?: string,
  ): Promise<{ ok: boolean; requireNote: boolean; error: string | null }> {
    const previousLead = leads.find((l) => l.id === id);
    const prevStageId = previousLead?.stage_id ?? null;

    if (prevStageId === targetStageId) {
      return { ok: true, requireNote: false, error: null };
    }

    // Optimistic update — stage_id muda imediatamente na UI
    setLeads((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, stage_id: targetStageId } : l
      )
    );

    try {
      const res = await fetch(`/api/crm/leads/${id}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_id: targetStageId, note }),
      });

      if (!res.ok) {
        const json = await res.json() as { error?: string };
        // Reverte optimistic update em qualquer erro
        setLeads((prev) =>
          prev.map((l) =>
            l.id === id ? { ...l, stage_id: prevStageId } : l
          )
        );
        const requireNote = res.status === 422;
        return {
          ok: false,
          requireNote,
          error: json.error ?? "Erro ao mover lead",
        };
      }

      return { ok: true, requireNote: false, error: null };
    } catch (err) {
      // Reverte em caso de erro de rede
      setLeads((prev) =>
        prev.map((l) =>
          l.id === id ? { ...l, stage_id: prevStageId } : l
        )
      );
      return {
        ok: false,
        requireNote: false,
        error: err instanceof Error ? err.message : "Erro ao mover lead",
      };
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function getLeadById(id: string): Lead | undefined {
    return leads.find((l) => l.id === id);
  }

  return {
    leads:        filteredLeads,   // filtered — what the board renders
    totalLeads:   leads.length,    // unfiltered total (for "X leads no funil" label)
    leadsByStage,
    isLoading,
    error,
    createLead,
    updateLead,
    deleteLead,
    moveLead,
    getLeadById,
    refetch: fetchLeads,
  };
}
