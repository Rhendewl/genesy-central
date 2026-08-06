"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MarketingInstagramAccountTotals, MarketingInstagramConnection, MarketingInstagramDailyInsight, MarketingInstagramMedia } from "@/types/marketing";

const AUTO_SYNC_AFTER_MS = 15 * 60 * 1000;
const LIVE_METRICS_REFRESH_MS = 5 * 60 * 1000;

async function parseResponse<T>(response: Response): Promise<T> {
  const json = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(json.error ?? "Não foi possível concluir a operação");
  return json;
}

export function useInstagramMarketing(start: string, end: string, compareStart: string, compareEnd: string) {
  const [connections, setConnections] = useState<MarketingInstagramConnection[]>([]);
  const [media, setMedia] = useState<MarketingInstagramMedia[]>([]);
  const [previousMedia, setPreviousMedia] = useState<MarketingInstagramMedia[]>([]);
  const [accountTotals, setAccountTotals] = useState<MarketingInstagramAccountTotals | null>(null);
  const [previousAccountTotals, setPreviousAccountTotals] = useState<MarketingInstagramAccountTotals | null>(null);
  const [dailyInsights, setDailyInsights] = useState<MarketingInstagramDailyInsight[]>([]);
  const [metricsSource, setMetricsSource] = useState<"account" | "content_fallback">("account");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const autoSyncStarted = useRef(new Set<string>());
  const requestSequence = useRef(0);

  const refetch = useCallback(async () => {
    const requestId = ++requestSequence.current;
    try {
      setIsRefreshing(true);
      setError(null);
      const params = new URLSearchParams({ start, end, compareStart, compareEnd, historyStart: compareStart });
      const data = await parseResponse<{
        connections: MarketingInstagramConnection[]; media: MarketingInstagramMedia[]; previous_media: MarketingInstagramMedia[];
        account_totals: MarketingInstagramAccountTotals; previous_account_totals: MarketingInstagramAccountTotals;
        daily_insights: MarketingInstagramDailyInsight[]; metrics_source: "account" | "content_fallback"; is_admin: boolean;
      }>(
        await fetch(`/api/marketing/instagram?${params}`, { cache: "no-store" }),
      );
      if (requestId !== requestSequence.current) return;
      setConnections(data.connections);
      setMedia(data.media);
      setPreviousMedia(data.previous_media);
      setAccountTotals(data.account_totals);
      setPreviousAccountTotals(data.previous_account_totals);
      setDailyInsights(data.daily_insights);
      setMetricsSource(data.metrics_source);
      setIsAdmin(data.is_admin);
    } catch (requestError) {
      if (requestId !== requestSequence.current) return;
      setError(requestError instanceof Error ? requestError.message : "Erro ao carregar o Instagram");
    } finally {
      if (requestId === requestSequence.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [compareEnd, compareStart, end, start]);

  useEffect(() => { void refetch(); }, [refetch]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refetch();
    }, LIVE_METRICS_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [refetch]);

  const sync = useCallback(async (connectionId: string) => {
    setSyncing((current) => ({ ...current, [connectionId]: true }));
    try {
      await parseResponse(await fetch("/api/marketing/instagram/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      }));
      await refetch();
      return { error: null };
    } catch (requestError) {
      await refetch();
      return { error: requestError instanceof Error ? requestError.message : "Erro ao sincronizar" };
    } finally {
      setSyncing((current) => ({ ...current, [connectionId]: false }));
    }
  }, [refetch]);

  useEffect(() => {
    if (!isAdmin) return;
    for (const connection of connections) {
      const stale = !connection.last_sync_at || Date.now() - new Date(connection.last_sync_at).getTime() > AUTO_SYNC_AFTER_MS;
      if (stale && !autoSyncStarted.current.has(connection.id)) {
        autoSyncStarted.current.add(connection.id);
        void sync(connection.id);
      }
    }
  }, [connections, isAdmin, sync]);

  const disconnect = useCallback(async (connectionId: string) => {
    try {
      await parseResponse(await fetch("/api/marketing/instagram", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      }));
      await refetch();
      return { error: null };
    } catch (requestError) {
      return { error: requestError instanceof Error ? requestError.message : "Erro ao desconectar" };
    }
  }, [refetch]);

  return {
    connections, media, previousMedia, accountTotals, previousAccountTotals, dailyInsights, metricsSource,
    isAdmin, isLoading, isRefreshing, syncing, error, refetch, sync, disconnect,
    connect: () => { window.location.href = "/api/marketing/instagram/auth"; },
  };
}
