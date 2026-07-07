"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  AutomationWithDetails,
  CreateAutomationInput,
  UpdateAutomationInput,
  AutomationConditionInput,
  AutomationActionInput,
} from "@/lib/workflow-engine/workflow-service";

export function useCrmAutomations(pipelineId: string | null) {
  const [automations, setAutomations] = useState<AutomationWithDetails[]>([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const mountedRef                    = useRef(true);

  const refetch = useCallback(async () => {
    if (!pipelineId) {
      setAutomations([]);
      return;
    }
    setError(null);
    try {
      const res  = await fetch(`/api/crm/automations?pipeline_id=${pipelineId}`);
      const json = await res.json() as { automations?: AutomationWithDetails[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Erro ao carregar automações");
      if (mountedRef.current) setAutomations(json.automations ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      if (mountedRef.current) setError(msg);
    }
  }, [pipelineId]);

  useEffect(() => {
    mountedRef.current = true;
    setIsLoading(true);
    refetch().finally(() => { if (mountedRef.current) setIsLoading(false); });
    return () => { mountedRef.current = false; };
  }, [refetch]);

  const createAutomation = useCallback(async (data: CreateAutomationInput): Promise<boolean> => {
    const res  = await fetch("/api/crm/automations", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });
    const json = await res.json() as { id?: string; error?: string };
    if (!res.ok) {
      toast.error(json.error ?? "Erro ao criar automação");
      return false;
    }
    toast.success("Automação criada");
    await refetch();
    return true;
  }, [refetch]);

  const updateAutomation = useCallback(async (id: string, data: UpdateAutomationInput): Promise<boolean> => {
    const res  = await fetch(`/api/crm/automations/${id}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });
    const json = await res.json() as { ok?: boolean; error?: string };
    if (!res.ok) {
      toast.error(json.error ?? "Erro ao atualizar automação");
      return false;
    }
    await refetch();
    return true;
  }, [refetch]);

  const setAutomationStatus = useCallback(async (id: string, status: "ativa" | "pausada"): Promise<boolean> => {
    if (mountedRef.current) {
      setAutomations(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    }
    const ok = await updateAutomation(id, { status });
    if (!ok) await refetch(); // reverte optimistic update em caso de falha
    return ok;
  }, [updateAutomation, refetch]);

  const replaceConditions = useCallback(async (id: string, conditions: AutomationConditionInput[]): Promise<boolean> => {
    const res  = await fetch(`/api/crm/automations/${id}/conditions`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ conditions }),
    });
    const json = await res.json() as { ok?: boolean; error?: string };
    if (!res.ok) {
      toast.error(json.error ?? "Erro ao salvar condições");
      return false;
    }
    await refetch();
    return true;
  }, [refetch]);

  const replaceActions = useCallback(async (id: string, actions: AutomationActionInput[]): Promise<boolean> => {
    const res  = await fetch(`/api/crm/automations/${id}/actions`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ actions }),
    });
    const json = await res.json() as { ok?: boolean; error?: string };
    if (!res.ok) {
      toast.error(json.error ?? "Erro ao salvar ações");
      return false;
    }
    await refetch();
    return true;
  }, [refetch]);

  const deleteAutomation = useCallback(async (id: string): Promise<boolean> => {
    const res  = await fetch(`/api/crm/automations/${id}`, { method: "DELETE" });
    const json = await res.json() as { ok?: boolean; error?: string };
    if (!res.ok) {
      toast.error(json.error ?? "Erro ao remover automação");
      return false;
    }
    toast.success("Automação removida");
    if (mountedRef.current) setAutomations(prev => prev.filter(a => a.id !== id));
    return true;
  }, []);

  return {
    automations, isLoading, error, refetch,
    createAutomation, updateAutomation, setAutomationStatus,
    replaceConditions, replaceActions, deleteAutomation,
  };
}
