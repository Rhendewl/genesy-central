"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AsaasStatus = "idle" | "connected" | "error" | "disconnected";
export type AsaasEnv    = "sandbox" | "production";

export interface AsaasIntegrationState {
  status:      AsaasStatus;
  environment: AsaasEnv | null;
  lastSyncAt:  string | null;
  accountName: string | null;
  createdAt:   string | null;
}

interface UseAsaasIntegrationReturn {
  integration: AsaasIntegrationState;
  isLoading:   boolean;
  isConnecting: boolean;
  isDisconnecting: boolean;
  connectError:    string | null;
  connect:     (apiKey: string, env: AsaasEnv) => Promise<{ error: string | null }>;
  disconnect:  () => Promise<void>;
  refetch:     () => Promise<void>;
}

const EMPTY: AsaasIntegrationState = {
  status:      "disconnected",
  environment: null,
  lastSyncAt:  null,
  accountName: null,
  createdAt:   null,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAsaasIntegration(): UseAsaasIntegrationReturn {
  const [integration, setIntegration]   = useState<AsaasIntegrationState>(EMPTY);
  const [isLoading, setIsLoading]       = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res  = await fetch("/api/integrations/asaas/status");
      const data = await res.json() as {
        connected?:   boolean;
        status?:      string;
        environment?: string;
        lastSyncAt?:  string;
        accountName?: string;
        createdAt?:   string;
        error?:       string;
      };

      if (!res.ok || data.error) {
        setIntegration(EMPTY);
        return;
      }

      if (!data.connected) {
        setIntegration(EMPTY);
        return;
      }

      setIntegration({
        status:      (data.status as AsaasStatus) ?? "connected",
        environment: (data.environment as AsaasEnv) ?? null,
        lastSyncAt:  data.lastSyncAt ?? null,
        accountName: data.accountName ?? null,
        createdAt:   data.createdAt ?? null,
      });
    } catch {
      setIntegration(EMPTY);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    fetchStatus().finally(() => setIsLoading(false));
  }, [fetchStatus]);

  const connect = useCallback(async (
    apiKey: string,
    env: AsaasEnv,
  ): Promise<{ error: string | null }> => {
    setIsConnecting(true);
    setConnectError(null);
    try {
      const res  = await fetch("/api/integrations/asaas/connect", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ apiKey, environment: env }),
      });
      const data = await res.json() as {
        success?:     boolean;
        accountName?: string;
        environment?: string;
        error?:       string;
      };

      if (!res.ok || data.error) {
        const msg = data.error ?? "Erro ao conectar. Tente novamente.";
        setConnectError(msg);
        return { error: msg };
      }

      // Optimistic update — refetch in background to get DB state
      setIntegration({
        status:      "connected",
        environment: (data.environment as AsaasEnv) ?? env,
        lastSyncAt:  new Date().toISOString(),
        accountName: data.accountName ?? null,
        createdAt:   new Date().toISOString(),
      });
      fetchStatus().catch(() => null);
      return { error: null };
    } catch {
      const msg = "Erro de rede. Verifique sua conexão.";
      setConnectError(msg);
      return { error: msg };
    } finally {
      setIsConnecting(false);
    }
  }, [fetchStatus]);

  const disconnect = useCallback(async () => {
    setIsDisconnecting(true);
    try {
      await fetch("/api/integrations/asaas/disconnect", { method: "DELETE" });
      setIntegration(EMPTY);
    } finally {
      setIsDisconnecting(false);
    }
  }, []);

  return {
    integration,
    isLoading,
    isConnecting,
    isDisconnecting,
    connectError,
    connect,
    disconnect,
    refetch: fetchStatus,
  };
}
