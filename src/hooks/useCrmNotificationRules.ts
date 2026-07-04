"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  CrmNotificationRuleWithNames,
  NewCrmNotificationRule,
  UpdateCrmNotificationRule,
} from "@/types/crm";

export function useCrmNotificationRules() {
  const [rules,     setRules]     = useState<CrmNotificationRuleWithNames[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const mountedRef                = useRef(true);

  const refetch = useCallback(async () => {
    setError(null);
    try {
      const res  = await fetch("/api/crm/notification-rules");
      const json = await res.json() as { rules?: CrmNotificationRuleWithNames[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Erro ao carregar regras");
      if (mountedRef.current) setRules(json.rules ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
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

  const createRule = useCallback(async (data: NewCrmNotificationRule): Promise<boolean> => {
    const res  = await fetch("/api/crm/notification-rules", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });
    const json = await res.json() as { id?: string; error?: string };
    if (!res.ok) {
      toast.error(json.error ?? "Erro ao criar regra");
      return false;
    }
    toast.success("Regra criada");
    await refetch();
    return true;
  }, [refetch]);

  const updateRule = useCallback(async (id: string, data: UpdateCrmNotificationRule): Promise<boolean> => {
    const res  = await fetch(`/api/crm/notification-rules/${id}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });
    const json = await res.json() as { ok?: boolean; error?: string };
    if (!res.ok) {
      toast.error(json.error ?? "Erro ao atualizar regra");
      return false;
    }
    if (mountedRef.current) {
      setRules(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));
    }
    return true;
  }, []);

  const deleteRule = useCallback(async (id: string): Promise<boolean> => {
    const res  = await fetch(`/api/crm/notification-rules/${id}`, { method: "DELETE" });
    const json = await res.json() as { ok?: boolean; error?: string };
    if (!res.ok) {
      toast.error(json.error ?? "Erro ao remover regra");
      return false;
    }
    toast.success("Regra removida");
    if (mountedRef.current) setRules(prev => prev.filter(r => r.id !== id));
    return true;
  }, []);

  return { rules, isLoading, error, refetch, createRule, updateRule, deleteRule };
}
