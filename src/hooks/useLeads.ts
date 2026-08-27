"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { toast } from "sonner";
import { getSupabaseClient } from "@/lib/supabase";
import type {
  Lead,
  NewLead,
  UpdateLead,
} from "@/types";
import type { DateFilter } from "@/components/crm/PeriodFilter";
import { useCurrentMember } from "@/context/CurrentMemberContext";
import { isAdministrativeMember } from "@/lib/user-access";
import { countCanonicalLeads } from "@/lib/crm/lead-identity";
import { sortLeadsByRecentActivity } from "@/lib/crm/lead-order";
import { applyLeadStageRealtimeMessage, parseLeadStageRealtimeMessage, type LeadStageRealtimeMessage } from "@/lib/crm/lead-realtime";

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

function normalizeLead(lead: Lead): Lead {
  return { ...lead, deal_value: lead.deal_value ?? 0 };
}

function upsertLead(leads: Lead[], lead: Lead): Lead[] {
  const normalized = normalizeLead(lead);
  return leads.some(item => item.id === lead.id)
    ? leads.map(item => item.id === lead.id ? { ...item, ...normalized } : item)
    : [normalized, ...leads];
}

export function useLeads(dateFilter?: DateFilter | null) {
  const supabase = getSupabaseClient();
  const { member, isOwner, isLoading: memberLoading } = useCurrentMember();
  const hasFullCrmAccess = isAdministrativeMember(member, isOwner === true);
  const restrictedPipelineId = hasFullCrmAccess ? null : member?.crm_pipeline_id ?? null;

  const [leads, setLeads] = useState<Lead[]>([]);   // full unfiltered list
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ref para evitar atualização de estado em componente desmontado
  const mountedRef = useRef(true);
  const latestFetchIdRef = useRef(0);
  const realtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchLeads = useCallback(async () => {
    const fetchId = ++latestFetchIdRef.current;
    setError(null);
    if (!hasFullCrmAccess && !restrictedPipelineId) {
      if (mountedRef.current) setLeads([]);
      return;
    }

    let query = supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (restrictedPipelineId) query = query.eq("pipeline_id", restrictedPipelineId);
    const { data, error: err } = await query;

    if (!mountedRef.current || fetchId !== latestFetchIdRef.current) return;

    if (err) {
      setError(err.message);
      return;
    }
    // Normaliza deal_value: registros antigos podem não ter o campo ainda
    const normalized = ((data as Lead[]) ?? []).map(normalizeLead);
    setLeads(normalized);
  }, [supabase, hasFullCrmAccess, restrictedPipelineId]);

  const scheduleRealtimeRefresh = useCallback(() => {
    if (realtimeRefreshTimerRef.current) clearTimeout(realtimeRefreshTimerRef.current);
    realtimeRefreshTimerRef.current = setTimeout(() => {
      realtimeRefreshTimerRef.current = null;
      void fetchLeads();
    }, 180);
  }, [fetchLeads]);

  // ── Real-time subscription ─────────────────────────────────────────────────

  useEffect(() => {
    if (memberLoading || isOwner === null) return;
    mountedRef.current = true;
    setIsLoading(true);

    fetchLeads().finally(() => {
      if (mountedRef.current) setIsLoading(false);
    });

    const channel = supabase
      .channel(`leads-realtime-${member?.owner_id ?? "self"}`)
      .on("broadcast", { event: "lead-stage-changed" }, ({ payload }) => {
        const message = parseLeadStageRealtimeMessage(payload);
        if (!message) return;
        latestFetchIdRef.current += 1;
        setLeads(prev => applyLeadStageRealtimeMessage(prev, message));
        scheduleRealtimeRefresh();
      })
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
          latestFetchIdRef.current += 1;
          if (!restrictedPipelineId || lead.pipeline_id === restrictedPipelineId) {
            setLeads(prev => upsertLead(prev, lead));
          }
          scheduleRealtimeRefresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "leads" },
        (payload) => {
          latestFetchIdRef.current += 1;
          const lead = payload.new as Lead;
          setLeads(prev => restrictedPipelineId && lead.pipeline_id !== restrictedPipelineId
            ? prev.filter(item => item.id !== lead.id)
            : upsertLead(prev, lead));
          scheduleRealtimeRefresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "leads" },
        (payload) => {
          latestFetchIdRef.current += 1;
          const deleted = payload.old as { id?: string };
          if (deleted.id) setLeads(prev => prev.filter(item => item.id !== deleted.id));
          scheduleRealtimeRefresh();
        }
      )
      .subscribe(status => {
        if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") scheduleRealtimeRefresh();
      });
    realtimeChannelRef.current = channel;

    // Segunda camada de segurança: se o websocket for suspenso ou a tabela
    // deixar de emitir eventos, a tela visível ainda se reconcilia sozinha.
    const reconciliationInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") scheduleRealtimeRefresh();
    }, 10_000);

    return () => {
      mountedRef.current = false;
      latestFetchIdRef.current += 1;
      if (realtimeRefreshTimerRef.current) clearTimeout(realtimeRefreshTimerRef.current);
      window.clearInterval(reconciliationInterval);
      if (realtimeChannelRef.current === channel) realtimeChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [fetchLeads, supabase, memberLoading, isOwner, member?.owner_id, restrictedPipelineId, scheduleRealtimeRefresh]);

  // Realtime pode ser suspenso pelo sistema operacional quando o PWA fica em
  // segundo plano. Ao voltar, reconciliamos silenciosamente sem recarregar a página.
  useEffect(() => {
    const refreshWhenActive = () => {
      if (document.visibilityState === "visible") scheduleRealtimeRefresh();
    };
    document.addEventListener("visibilitychange", refreshWhenActive);
    window.addEventListener("focus", refreshWhenActive);
    window.addEventListener("online", refreshWhenActive);
    return () => {
      document.removeEventListener("visibilitychange", refreshWhenActive);
      window.removeEventListener("focus", refreshWhenActive);
      window.removeEventListener("online", refreshWhenActive);
    };
  }, [scheduleRealtimeRefresh]);

  // ── Derived: apply date filter client-side (instant, preserves real-time) ──

  const filteredLeads = useMemo(() => {
    const visibleLeads = !dateFilter ? leads : leads.filter(l => {
      const d = new Date(l[dateFilter.field]);
      return d >= dateFilter.from && d <= dateFilter.to;
    });
    return sortLeadsByRecentActivity(visibleLeads);
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
    try {
      const res = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json() as { lead?: Lead; id?: string; error?: string };
      if (!res.ok) return { error: json.error ?? "Erro ao criar lead" };

      if (json.lead) {
        setLeads((prev) => [
          { ...json.lead!, deal_value: json.lead!.deal_value ?? 0 },
          ...prev.filter(lead => lead.id !== json.lead!.id),
        ]);
      } else {
        await fetchLeads();
      }
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Erro ao criar lead" };
    }
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  async function updateLead(
    id: string,
    data: UpdateLead
  ): Promise<{ error: string | null }> {
    const previous = leads.find(lead => lead.id === id);
    setLeads(current => current.map(lead => lead.id === id ? { ...lead, ...data } as Lead : lead));

    // tags passa pelo servidor (não pelo update direto abaixo) — é o único
    // jeito do Workflow Engine conseguir reagir a "lead recebeu/removeu tag",
    // já que essa rota publica lead.tag.added/removed no EventBus.
    const { tags, ...rest } = data;

    if (tags !== undefined) {
      const res = await fetch(`/api/crm/leads/${id}/tags`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        if (previous) setLeads(current => upsertLead(current, previous));
        return { error: json.error ?? "Erro ao atualizar tags" };
      }
    }

    if (Object.keys(rest).length > 0) {
      const { error: err } = await supabase
        .from("leads")
        .update(rest)
        .eq("id", id);
      if (err) {
        if (previous) setLeads(current => upsertLead(current, previous));
        void fetchLeads();
        return { error: err.message };
      }
    }

    scheduleRealtimeRefresh();
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
    const previousUpdatedAt = previousLead?.updated_at;

    if (prevStageId === targetStageId) {
      return { ok: true, requireNote: false, error: null };
    }

    // Optimistic update — stage_id muda imediatamente na UI
    const movedAt = new Date().toISOString();
    const mutationId = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const broadcastStage = (message: LeadStageRealtimeMessage) => {
      void realtimeChannelRef.current?.send({ type: "broadcast", event: "lead-stage-changed", payload: message });
    };
    setLeads((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, stage_id: targetStageId, updated_at: movedAt } : l
      )
    );
    broadcastStage({ leadId: id, stageId: targetStageId, updatedAt: movedAt, mutationId });

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
            l.id === id
              ? { ...l, stage_id: prevStageId, updated_at: previousUpdatedAt ?? l.updated_at }
              : l
          )
        );
        broadcastStage({ leadId: id, stageId: prevStageId, updatedAt: new Date().toISOString(), mutationId, rollback: true });
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
          l.id === id
            ? { ...l, stage_id: prevStageId, updated_at: previousUpdatedAt ?? l.updated_at }
            : l
        )
      );
      broadcastStage({ leadId: id, stageId: prevStageId, updatedAt: new Date().toISOString(), mutationId, rollback: true });
      return {
        ok: false,
        requireNote: false,
        error: err instanceof Error ? err.message : "Erro ao mover lead",
      };
    }
  }

  async function transferLead(
    id: string,
    targetStageId: string,
    note?: string,
    assigneeId?: string | null,
  ): Promise<{ ok: boolean; requireNote: boolean; alreadyExists: boolean; error: string | null }> {
    try {
      const res = await fetch(`/api/crm/leads/${id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_id: targetStageId, note, assignee_id: assigneeId ?? null }),
      });
      const json = await res.json() as { error?: string; already_exists?: boolean };
      if (!res.ok) {
        return { ok: false, requireNote: res.status === 422, alreadyExists: false, error: json.error ?? "Erro ao criar cópia do lead" };
      }
      await fetchLeads();
      return { ok: true, requireNote: false, alreadyExists: json.already_exists === true, error: null };
    } catch (err) {
      return {
        ok: false,
        requireNote: false,
        alreadyExists: false,
        error: err instanceof Error ? err.message : "Erro ao criar cópia do lead",
      };
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function getLeadById(id: string): Lead | undefined {
    return leads.find((l) => l.id === id);
  }

  return {
    leads:        filteredLeads,   // filtered — what the board renders
    totalLeads:   countCanonicalLeads(leads),
    leadsByStage,
    isLoading,
    error,
    createLead,
    updateLead,
    deleteLead,
    moveLead,
    transferLead,
    getLeadById,
    refetch: fetchLeads,
  };
}
