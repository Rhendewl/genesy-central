"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { AdPlatformAccount, MetaAdAccount, MetaSyncLog } from "@/types";

// ── Auto-sync: trigger sync if last_sync_at > 1h ago ─────────────────────────

const ONE_HOUR_MS = 60 * 60 * 1000;

function needsSync(account: AdPlatformAccount): boolean {
  if (account.status !== "connected") return false;
  if (!account.last_sync_at) return true;
  return Date.now() - new Date(account.last_sync_at).getTime() > ONE_HOUR_MS;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseMetaIntegrationsReturn {
  connections: AdPlatformAccount[];
  syncLogs:    MetaSyncLog[];
  isLoading:   boolean;
  syncing:     Record<string, boolean>;  // platformAccountId → isSyncing
  error:       string | null;
  refetch:     () => Promise<void>;
  initiateOAuth: (clientId?: string | null) => void;
  connectAccount: (params: {
    pendingId:     string;
    adAccountId:   string;
    adAccountName: string;
    clientId?:     string | null;
  }) => Promise<{ error: string | null }>;
  syncAccount:   (platformAccountId: string, since?: string, until?: string) => Promise<{ error: string | null }>;
  disconnect:    (platformAccountId: string) => Promise<{ error: string | null }>;
  fetchPendingAccounts: (pendingId: string) => Promise<MetaAdAccount[]>;
}

export function useMetaIntegrations(): UseMetaIntegrationsReturn {
  const [connections, setConnections] = useState<AdPlatformAccount[]>([]);
  const [syncLogs,    setSyncLogs]    = useState<MetaSyncLog[]>([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const [syncing,     setSyncing]     = useState<Record<string, boolean>>({});
  const [error,       setError]       = useState<string | null>(null);
  const autoSyncDone = useRef(new Set<string>());

  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const supabase = getSupabaseClient();

      const [{ data: conns }, { data: logs }] = await Promise.all([
        supabase
          .from("ad_platform_accounts")
          .select("*, client:agency_clients(id, name)")
          .eq("platform", "meta")
          .order("created_at"),
        supabase
          .from("meta_sync_logs")
          .select("*")
          .order("started_at", { ascending: false })
          .limit(20),
      ]);

      setConnections((conns ?? []) as AdPlatformAccount[]);
      setSyncLogs((logs ?? []) as MetaSyncLog[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar integrações");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  // Auto-sync stale connections
  useEffect(() => {
    for (const acc of connections) {
      if (!autoSyncDone.current.has(acc.id) && needsSync(acc)) {
        autoSyncDone.current.add(acc.id);
        syncAccount(acc.id).catch(() => null);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections]);

  // ── OAuth initiation ────────────────────────────────────────────────────────

  const initiateOAuth = useCallback((clientId?: string | null) => {
    const params = new URLSearchParams();
    if (clientId) params.set("clientId", clientId);
    window.location.href = `/api/meta/auth?${params}`;
  }, []);

  // ── Fetch ad accounts for pending connection ──────────────────────────────

  const fetchPendingAccounts = useCallback(async (pendingId: string): Promise<MetaAdAccount[]> => {
    const res = await globalThis.fetch(`/api/meta/accounts?pendingId=${pendingId}`);
    const json = await res.json() as { accounts?: MetaAdAccount[]; error?: string };
    if (!res.ok) throw new Error(json.error ?? "Erro ao buscar contas");
    return json.accounts ?? [];
  }, []);

  // ── Connect account after OAuth ───────────────────────────────────────────

  const connectAccount = useCallback(async (params: {
    pendingId:     string;
    adAccountId:   string;
    adAccountName: string;
    clientId?:     string | null;
  }): Promise<{ error: string | null }> => {
    try {
      const res = await globalThis.fetch("/api/meta/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) return { error: json.error ?? "Erro ao conectar" };
      await fetch();
      return { error: null };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : "Erro ao conectar" };
    }
  }, [fetch]);

  // ── Manual sync ───────────────────────────────────────────────────────────

  const syncAccount = useCallback(async (
    platformAccountId: string,
    since?: string,
    until?: string
  ): Promise<{ error: string | null }> => {
    setSyncing(prev => ({ ...prev, [platformAccountId]: true }));
    try {
      const res = await globalThis.fetch("/api/meta/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platformAccountId, since, until }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) return { error: json.error ?? "Erro ao sincronizar" };
      await fetch();
      return { error: null };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : "Erro ao sincronizar" };
    } finally {
      setSyncing(prev => ({ ...prev, [platformAccountId]: false }));
    }
  }, [fetch]);

  // ── Disconnect ────────────────────────────────────────────────────────────

  const disconnect = useCallback(async (platformAccountId: string): Promise<{ error: string | null }> => {
    try {
      const res = await globalThis.fetch("/api/meta/disconnect", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platformAccountId }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) return { error: json.error ?? "Erro ao desconectar" };
      await fetch();
      return { error: null };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : "Erro ao desconectar" };
    }
  }, [fetch]);

  return {
    connections, syncLogs, isLoading, syncing, error,
    refetch: fetch,
    initiateOAuth, connectAccount, syncAccount, disconnect,
    fetchPendingAccounts,
  };
}
