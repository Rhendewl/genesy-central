"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MarketingInstagramConnection, MarketingInstagramMedia } from "@/types/marketing";

const AUTO_SYNC_AFTER_MS = 15 * 60 * 1000;

async function parseResponse<T>(response: Response): Promise<T> {
  const json = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(json.error ?? "Não foi possível concluir a operação");
  return json;
}

export function useInstagramMarketing(start: string, end: string) {
  const [connections, setConnections] = useState<MarketingInstagramConnection[]>([]);
  const [media, setMedia] = useState<MarketingInstagramMedia[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const autoSyncStarted = useRef(new Set<string>());

  const refetch = useCallback(async () => {
    try {
      setError(null);
      const params = new URLSearchParams({ start, end });
      const data = await parseResponse<{ connections: MarketingInstagramConnection[]; media: MarketingInstagramMedia[]; is_admin: boolean }>(
        await fetch(`/api/marketing/instagram?${params}`, { cache: "no-store" }),
      );
      setConnections(data.connections);
      setMedia(data.media);
      setIsAdmin(data.is_admin);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erro ao carregar o Instagram");
    } finally {
      setIsLoading(false);
    }
  }, [end, start]);

  useEffect(() => { void refetch(); }, [refetch]);

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
    connections, media, isAdmin, isLoading, syncing, error, refetch, sync, disconnect,
    connect: () => { window.location.href = "/api/marketing/instagram/auth"; },
  };
}
