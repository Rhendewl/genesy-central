"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  CrmPipelineWithStages,
  NewCrmPipeline,
  UpdateCrmPipeline,
  NewCrmStage,
  UpdateCrmStage,
} from "@/types/crm";

// ─────────────────────────────────────────────────────────────────────────────
// usePipelines
//
// Carrega todos os pipelines do usuário (ativos + arquivados) com suas stages.
// Expõe mutações CRUD para pipelines e stages.
// Reorder de stages é otimista: estado local atualiza imediatamente; API
// persiste em background — falha reverte com toast de erro.
// ─────────────────────────────────────────────────────────────────────────────

export function usePipelines() {
  const [pipelines, setPipelines] = useState<CrmPipelineWithStages[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // Evita setState após unmount — mesmo padrão de useLeads.ts
  const mountedRef = useRef(true);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const refetch = useCallback(async () => {
    setError(null);
    try {
      // Fetch all pipelines (including archived) so admin can manage them.
      // The public GET only returns is_active=true; here we hit it without that filter.
      const res = await fetch("/api/crm/pipelines?all=1");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { pipelines?: CrmPipelineWithStages[] };
      const sorted = (json.pipelines ?? []).sort((a, b) => a.order_index - b.order_index);
      if (mountedRef.current) setPipelines(sorted);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar pipelines";
      if (mountedRef.current) setError(msg);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    setIsLoading(true);
    refetch().finally(() => {
      if (mountedRef.current) setIsLoading(false);
    });
    return () => { mountedRef.current = false; };
  }, [refetch]);

  // ── Pipeline mutations ─────────────────────────────────────────────────────

  const createPipeline = useCallback(async (data: NewCrmPipeline): Promise<boolean> => {
    const res = await fetch("/api/crm/pipelines", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });
    if (!res.ok) {
      const json = await res.json() as { error?: string };
      toast.error(json.error ?? "Erro ao criar pipeline");
      return false;
    }
    toast.success("Pipeline criado!");
    await refetch();
    return true;
  }, [refetch]);

  const updatePipeline = useCallback(async (id: string, data: UpdateCrmPipeline): Promise<boolean> => {
    const res = await fetch(`/api/crm/pipelines/${id}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });
    if (!res.ok) {
      const json = await res.json() as { error?: string };
      toast.error(json.error ?? "Erro ao atualizar pipeline");
      return false;
    }
    toast.success("Pipeline atualizado!");
    await refetch();
    return true;
  }, [refetch]);

  const archivePipeline = useCallback(async (id: string): Promise<boolean> => {
    const res = await fetch(`/api/crm/pipelines/${id}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ is_active: false }),
    });
    if (!res.ok) {
      toast.error("Erro ao arquivar pipeline");
      return false;
    }
    toast.success("Pipeline arquivado");
    await refetch();
    return true;
  }, [refetch]);

  const restorePipeline = useCallback(async (id: string): Promise<boolean> => {
    const res = await fetch(`/api/crm/pipelines/${id}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ is_active: true }),
    });
    if (!res.ok) {
      toast.error("Erro ao restaurar pipeline");
      return false;
    }
    toast.success("Pipeline restaurado");
    await refetch();
    return true;
  }, [refetch]);

  // ── Stage mutations ────────────────────────────────────────────────────────

  const createStage = useCallback(async (pipelineId: string, data: NewCrmStage): Promise<boolean> => {
    const res = await fetch(`/api/crm/pipelines/${pipelineId}/stages`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });
    if (!res.ok) {
      const json = await res.json() as { error?: string };
      toast.error(json.error ?? "Erro ao criar etapa");
      return false;
    }
    toast.success("Etapa criada!");
    await refetch();
    return true;
  }, [refetch]);

  const updateStage = useCallback(async (
    pipelineId: string,
    stageId:    string,
    data:       UpdateCrmStage,
  ): Promise<boolean> => {
    const res = await fetch(`/api/crm/pipelines/${pipelineId}/stages/${stageId}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });
    if (!res.ok) {
      const json = await res.json() as { error?: string };
      toast.error(json.error ?? "Erro ao atualizar etapa");
      return false;
    }
    toast.success("Etapa atualizada!");
    await refetch();
    return true;
  }, [refetch]);

  const deleteStage = useCallback(async (pipelineId: string, stageId: string): Promise<boolean> => {
    const res = await fetch(`/api/crm/pipelines/${pipelineId}/stages/${stageId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const json = await res.json() as { error?: string };
      toast.error(json.error ?? "Erro ao excluir etapa");
      return false;
    }
    toast.success("Etapa arquivada");
    await refetch();
    return true;
  }, [refetch]);

  // Optimistic reorder: update local state immediately, persist async, revert on failure.
  const reorderStages = useCallback(async (pipelineId: string, orderedIds: string[]): Promise<void> => {
    // Optimistic: rebuild stages with new order_index
    setPipelines(prev => prev.map(p => {
      if (p.id !== pipelineId) return p;
      const stageMap = new Map(p.crm_stages.map(s => [s.id, s]));
      const reordered = orderedIds
        .map((id, index) => {
          const stage = stageMap.get(id);
          return stage ? { ...stage, order_index: index } : null;
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);
      // Stages absent from orderedIds (inactive) are preserved unchanged
      const untouched = p.crm_stages.filter(s => !orderedIds.includes(s.id));
      return { ...p, crm_stages: [...reordered, ...untouched] };
    }));

    const res = await fetch(`/api/crm/pipelines/${pipelineId}/stages/reorder`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ order: orderedIds }),
    });

    if (!res.ok) {
      toast.error("Erro ao salvar ordem das etapas");
      await refetch(); // revert to server state
    }
  }, [refetch]);

  return {
    pipelines,
    isLoading,
    error,
    refetch,
    createPipeline,
    updatePipeline,
    archivePipeline,
    restorePipeline,
    createStage,
    updateStage,
    deleteStage,
    reorderStages,
  };
}
