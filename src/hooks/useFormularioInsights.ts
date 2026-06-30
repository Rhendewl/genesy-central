"use client";

import { useState, useCallback, useEffect } from "react";
import type { InsightsDomain } from "@/lib/analytics/types";
import type { Granularity } from "@/lib/analytics/metrics";

interface InsightsParams {
  since?:  string;
  until?:  string;
  device?: string;
}

interface UseFormularioInsightsReturn {
  insights:    InsightsDomain | null;
  granularity: Granularity;
  isLoading:   boolean;
  error:       string | null;
  refetch:     () => void;
}

export function useFormularioInsights(
  formId: string,
  params: InsightsParams = {},
): UseFormularioInsightsReturn {
  const [insights,    setInsights]    = useState<InsightsDomain | null>(null);
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [isLoading,   setIsLoading]   = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [rev,         setRev]         = useState(0);

  const { since, until, device } = params;

  const refetch = useCallback(() => setRev(r => r + 1), []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const sp = new URLSearchParams();
    if (since)  sp.set("since",  since);
    if (until)  sp.set("until",  until);
    if (device) sp.set("device", device);
    const qs  = sp.toString();
    const url = `/api/formularios/${formId}/insights${qs ? `?${qs}` : ""}`;

    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error("Erro ao carregar insights");
        return r.json() as Promise<{ insights: InsightsDomain; granularity: Granularity }>;
      })
      .then(json => {
        if (cancelled) return;
        setInsights(json.insights);
        setGranularity(json.granularity ?? "month");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Erro desconhecido");
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId, since, until, device, rev]);

  return { insights, granularity, isLoading, error, refetch };
}
