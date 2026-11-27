"use client";

import { useEffect, useMemo, useState } from "react";
import type { AttributionMap } from "@/lib/crm/tracking";

/** Busca UTM, dispositivo e navegador dos leads (formulário e site), em lote. */
export function useLeadAttribution(leadIds: string[], enabled = true) {
  const key = useMemo(() => [...leadIds].sort().join(","), [leadIds]);
  const [attribution, setAttribution] = useState<AttributionMap>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !key) { setAttribution({}); return; }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetch("/api/crm/rastreamento", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lead_ids: key.split(",") }) })
      .then(async res => {
        const json = await res.json().catch(() => ({})) as { attribution?: AttributionMap; error?: string };
        if (!res.ok) throw new Error(json.error ?? "Não foi possível carregar o rastreamento");
        if (!cancelled) setAttribution(json.attribution ?? {});
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : "Erro ao carregar o rastreamento"); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [key, enabled]);

  return { attribution, isLoading, error };
}
