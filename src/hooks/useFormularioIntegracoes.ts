"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";

export interface FormIntegrationRow {
  id:           string;
  form_id:      string;
  adapter:      string;
  enabled:      boolean;
  settings:     Record<string, unknown>;
  secrets:      Record<string, string>;   // values are "__masked__" from API
  event_filter: string[] | null;
  retry_policy: Record<string, unknown> | null;
  rate_limit:   { requestsPerMinute: number } | null;
  created_at:   string;
  updated_at:   string;
}

interface UseFormularioIntegracoesReturn {
  integrations: FormIntegrationRow[];
  isLoading:    boolean;
  error:        string | null;
  save:         (configId: string, patch: Partial<Omit<FormIntegrationRow, "id" | "form_id" | "created_at" | "updated_at">>) => Promise<boolean>;
  create:       (adapter: string) => Promise<FormIntegrationRow | null>;
  remove:       (configId: string) => Promise<boolean>;
  reload:       () => void;
}

export function useFormularioIntegracoes(formId: string): UseFormularioIntegracoesReturn {
  const [integrations, setIntegrations] = useState<FormIntegrationRow[]>([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [rev, setRev]                   = useState(0);

  const reload = useCallback(() => setRev(r => r + 1), []);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setError(null);

    fetch(`/api/formularios/${formId}/integracoes`)
      .then(r => r.json())
      .then(json => {
        if (!mounted) return;
        if (json.error) { setError(json.error); return; }
        setIntegrations(json.integrations ?? []);
      })
      .catch(() => { if (mounted) setError("Erro ao carregar integrações"); })
      .finally(() => { if (mounted) setIsLoading(false); });

    return () => { mounted = false; };
  }, [formId, rev]);

  const save = useCallback(async (
    configId: string,
    patch: Partial<Omit<FormIntegrationRow, "id" | "form_id" | "created_at" | "updated_at">>,
  ): Promise<boolean> => {
    const res = await fetch(`/api/formularios/${formId}/integracoes/${configId}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(patch),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error ?? "Erro ao salvar integração"); return false; }
    setIntegrations(prev => prev.map(i => i.id === configId ? json.integration : i));
    toast.success("Integração salva");
    return true;
  }, [formId]);

  const create = useCallback(async (adapter: string): Promise<FormIntegrationRow | null> => {
    const res = await fetch(`/api/formularios/${formId}/integracoes`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ adapter }),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error ?? "Erro ao criar integração"); return null; }
    setIntegrations(prev => [...prev, json.integration]);
    return json.integration;
  }, [formId]);

  const remove = useCallback(async (configId: string): Promise<boolean> => {
    const res = await fetch(`/api/formularios/${formId}/integracoes/${configId}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error ?? "Erro ao remover integração"); return false; }
    setIntegrations(prev => prev.filter(i => i.id !== configId));
    toast.success("Integração removida");
    return true;
  }, [formId]);

  return { integrations, isLoading, error, save, create, remove, reload };
}
