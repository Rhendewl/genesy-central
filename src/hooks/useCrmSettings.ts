"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  CrmConversionSource,
  CrmStage,
  CrmStageConversion,
  NewCrmConversionSource,
  NewCrmStageConversion,
  UpdateCrmConversionSource,
} from "@/types/crm";

export function useCrmSettings(pipelineId: string | null, stages: CrmStage[]) {
  const [sources,          setSources]          = useState<CrmConversionSource[]>([]);
  const [stageConversions, setStageConversions] = useState<CrmStageConversion[]>([]);
  const [isLoading,        setIsLoading]        = useState(false);
  const [error,            setError]            = useState<string | null>(null);

  const mountedRef = useRef(true);
  const stagesRef  = useRef(stages);
  // Sync stagesRef without causing refetch on every stages reference change.
  useEffect(() => { stagesRef.current = stages; }, [stages]);

  const refetch = useCallback(async () => {
    if (!pipelineId) return;
    setError(null);
    const currentStages = stagesRef.current;

    try {
      const [sourcesRes, ...convResArr] = await Promise.all([
        fetch(`/api/crm/conversion-sources?pipeline_id=${pipelineId}`),
        ...currentStages.map(s =>
          fetch(`/api/crm/pipelines/${pipelineId}/stages/${s.id}/conversions`)
        ),
      ]);

      if (!sourcesRes.ok) throw new Error("Erro ao carregar origens");
      const srcJson = await sourcesRes.json() as { sources?: CrmConversionSource[] };
      if (mountedRef.current) setSources(srcJson.sources ?? []);

      const all: CrmStageConversion[] = [];
      for (const res of convResArr) {
        if (res.ok) {
          const json = await res.json() as { conversions?: CrmStageConversion[] };
          all.push(...(json.conversions ?? []));
        }
      }
      if (mountedRef.current) setStageConversions(all);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar configurações";
      if (mountedRef.current) setError(msg);
    }
  }, [pipelineId]);

  useEffect(() => {
    mountedRef.current = true;
    if (!pipelineId) return;
    setIsLoading(true);
    refetch().finally(() => {
      if (mountedRef.current) setIsLoading(false);
    });
    return () => { mountedRef.current = false; };
  }, [pipelineId, refetch]);

  // ── Source mutations ────────────────────────────────────────────────────────

  const createSource = useCallback(async (data: NewCrmConversionSource): Promise<boolean> => {
    const res = await fetch("/api/crm/conversion-sources", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });
    if (!res.ok) {
      const json = await res.json() as { error?: string };
      toast.error(json.error ?? "Erro ao criar origem");
      return false;
    }
    toast.success("Origem criada!");
    await refetch();
    return true;
  }, [refetch]);

  const updateSource = useCallback(async (id: string, data: UpdateCrmConversionSource): Promise<boolean> => {
    const res = await fetch(`/api/crm/conversion-sources/${id}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });
    if (!res.ok) {
      const json = await res.json() as { error?: string };
      toast.error(json.error ?? "Erro ao atualizar origem");
      return false;
    }
    toast.success("Origem atualizada!");
    await refetch();
    return true;
  }, [refetch]);

  const deleteSource = useCallback(async (id: string): Promise<boolean> => {
    const res = await fetch(`/api/crm/conversion-sources/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json() as { error?: string };
      toast.error(json.error ?? "Erro ao remover origem");
      return false;
    }
    toast.success("Origem removida");
    await refetch();
    return true;
  }, [refetch]);

  // ── Stage conversion mutation ───────────────────────────────────────────────

  const upsertStageConversion = useCallback(async (
    stageId: string,
    data:    Omit<NewCrmStageConversion, "stage_id">,
  ): Promise<boolean> => {
    if (!pipelineId) return false;
    const res = await fetch(
      `/api/crm/pipelines/${pipelineId}/stages/${stageId}/conversions`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ platform: data.platform, enabled: data.enabled, settings: data.settings }),
      }
    );
    if (!res.ok) {
      const json = await res.json() as { error?: string };
      toast.error(json.error ?? "Erro ao salvar configuração da etapa");
      return false;
    }
    await refetch();
    return true;
  }, [pipelineId, refetch]);

  return {
    sources,
    stageConversions,
    isLoading,
    error,
    refetch,
    createSource,
    updateSource,
    deleteSource,
    upsertStageConversion,
  };
}
