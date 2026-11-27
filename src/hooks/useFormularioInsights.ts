"use client";

import { useState, useCallback, useEffect } from "react";
import type { FormReport, ReportGranularity, ReportRecommendation, ReportSummary } from "@/lib/analytics/report";

interface InsightsParams {
  since?:  string;
  until?:  string;
  device?: string;
}

export interface FormInsightsPayload {
  report:          FormReport;
  previous:        ReportSummary | null;
  recommendations: ReportRecommendation[];
  granularity:     ReportGranularity;
}

interface UseFormularioInsightsReturn {
  data:      FormInsightsPayload | null;
  isLoading: boolean;
  error:     string | null;
  refetch:   () => void;
}

export function useFormularioInsights(
  formId: string,
  params: InsightsParams = {},
): UseFormularioInsightsReturn {
  const [data,      setData]      = useState<FormInsightsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [rev,       setRev]       = useState(0);

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
      .then(async r => {
        const json = await r.json().catch(() => ({})) as Partial<FormInsightsPayload> & { error?: string };
        if (!r.ok || !json.report) throw new Error(json.error ?? "Erro ao carregar insights");
        return json as FormInsightsPayload;
      })
      .then(json => { if (!cancelled) setData(json); })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Erro desconhecido");
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [formId, since, until, device, rev]);

  return { data, isLoading, error, refetch };
}
