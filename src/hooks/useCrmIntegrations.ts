"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { AdPlatformAccount } from "@/types";

export interface MetaPageSub {
  id:                  string;
  page_id:             string;
  page_name:           string | null;
  is_active:           boolean;
  platform_account_id: string | null;
}

export interface CrmLeadSnippet {
  name:       string;
  created_at: string;
}

export interface WebhookIntegration {
  id:              string;
  api_key:         string;
  leads_count:     number;
  last_received_at: string | null;
  is_active:       boolean;
}

export interface CrmIntegrationsData {
  userId:              string | null;
  metaConnections:     AdPlatformAccount[];
  metaPages:           MetaPageSub[];
  lastMetaLead:        CrmLeadSnippet | null;
  webhookIntegration:  WebhookIntegration | null;
  isLoading:           boolean;
  error:               string | null;
  refetch:             () => Promise<void>;
  regenerateApiKey:    () => Promise<{ error: string | null }>;
  disconnectMeta:      (platformAccountId: string) => Promise<{ error: string | null }>;
  disconnectPage:      (pageId: string) => Promise<{ error: string | null }>;
  initiateMetaOAuth:   () => void;
}

export function useCrmIntegrations(): CrmIntegrationsData {
  const supabase = getSupabaseClient();

  const [userId,              setUserId]              = useState<string | null>(null);
  const [metaConnections,     setMetaConnections]     = useState<AdPlatformAccount[]>([]);
  const [metaPages,           setMetaPages]           = useState<MetaPageSub[]>([]);
  const [lastMetaLead,        setLastMetaLead]        = useState<CrmLeadSnippet | null>(null);
  const [webhookIntegration,  setWebhookIntegration]  = useState<WebhookIntegration | null>(null);
  const [isLoading,           setIsLoading]           = useState(true);
  const [error,               setError]               = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);

      const [
        { data: connections },
        { data: pages },
        { data: metaLeads },
        webhookRes,
      ] = await Promise.all([
        supabase
          .from("ad_platform_accounts")
          .select("*, client:agency_clients(id, name)")
          .eq("platform", "meta")
          .neq("status", "disconnected")
          .order("created_at"),

        supabase
          .from("meta_page_subscriptions")
          .select("id, page_id, page_name, is_active, platform_account_id")
          .eq("is_active", true)
          .order("created_at"),

        supabase
          .from("leads")
          .select("name, created_at")
          .eq("source", "meta_lead_ads")
          .order("created_at", { ascending: false })
          .limit(1),

        globalThis.fetch("/api/webhooks"),
      ]);

      setMetaConnections((connections ?? []) as AdPlatformAccount[]);
      setMetaPages((pages ?? []) as MetaPageSub[]);
      setLastMetaLead(metaLeads?.[0] ?? null);

      if (webhookRes.ok) {
        const json = await webhookRes.json() as { integration?: WebhookIntegration };
        setWebhookIntegration(json.integration ?? null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar integrações");
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => { fetch(); }, [fetch]);

  const regenerateApiKey = useCallback(async (): Promise<{ error: string | null }> => {
    try {
      const res  = await globalThis.fetch("/api/webhooks/regenerate", { method: "POST" });
      const json = await res.json() as { api_key?: string; error?: string };
      if (!res.ok || json.error) return { error: json.error ?? "Erro ao regenerar" };
      setWebhookIntegration(prev => prev ? { ...prev, api_key: json.api_key! } : prev);
      return { error: null };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : "Erro ao regenerar" };
    }
  }, []);

  const disconnectMeta = useCallback(async (platformAccountId: string) => {
    try {
      const res = await globalThis.fetch("/api/meta/disconnect", {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ platformAccountId }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) return { error: json.error ?? "Erro ao desconectar" };
      await fetch();
      return { error: null };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : "Erro ao desconectar" };
    }
  }, [fetch]);

  const disconnectPage = useCallback(async (pageId: string) => {
    try {
      const { error: err } = await supabase
        .from("meta_page_subscriptions")
        .update({ is_active: false })
        .eq("page_id", pageId);
      if (err) return { error: err.message };
      await fetch();
      return { error: null };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : "Erro ao desconectar formulário" };
    }
  }, [supabase, fetch]);

  const initiateMetaOAuth = useCallback(() => {
    window.location.href = "/api/meta/auth?return_to=/crm/integracoes";
  }, []);

  return {
    userId,
    metaConnections,
    metaPages,
    lastMetaLead,
    webhookIntegration,
    isLoading,
    error,
    refetch:           fetch,
    regenerateApiKey,
    disconnectMeta,
    disconnectPage,
    initiateMetaOAuth,
  };
}
