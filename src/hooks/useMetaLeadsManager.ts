"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { Lead } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PageItem {
  id:                  string;
  page_id:             string;
  page_name:           string | null;
  is_active:           boolean;
  platform_account_id: string | null;
  created_at:          string;
}

export interface FormItem {
  id:            string;
  name:          string;
  status:        string;
  leads_count:   number;
  is_subscribed: boolean;
  last_lead_at:  string | null;
}

export interface WebhookLogItem {
  id:            string;
  received_at:   string;
  page_id:       string | null;
  form_id:       string | null;
  leadgen_id:    string | null;
  status:        "received" | "processed" | "duplicate" | "error" | "skipped";
  step:          string | null;
  error_message: string | null;
  processed_at:  string | null;
  lead_id:       string | null;
}

export interface TestResult {
  ok:      boolean;
  message?: string;
  error?:   string;
  hint?:    string;
  note?:    string;
  page?:    { id: string; name: string };
  lead?:    { name: string | null; phone: string | null; email: string | null };
}

export type WebhookStatus = "active" | "waiting" | "error";

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useMetaLeadsManager() {
  const supabase = getSupabaseClient();

  const [pages,            setPages]            = useState<PageItem[]>([]);
  const [hasMetaAccount,   setHasMetaAccount]   = useState<boolean | null>(null);
  const [selectedPageId,   setSelectedPageId]   = useState<string | null>(null);
  const [forms,            setForms]            = useState<FormItem[]>([]);
  const [recentLeads,      setRecentLeads]      = useState<Lead[]>([]);
  const [webhookLogs,      setWebhookLogs]      = useState<WebhookLogItem[]>([]);
  const [webhookStatus,    setWebhookStatus]    = useState<WebhookStatus>("waiting");
  const [isLoadingPages,   setIsLoadingPages]   = useState(true);
  const [isLoadingForms,   setIsLoadingForms]   = useState(false);
  const [isSyncing,        setIsSyncing]        = useState(false);
  const [isTesting,        setIsTesting]        = useState(false);
  const [testResult,       setTestResult]       = useState<TestResult | null>(null);
  const [togglingForms,    setTogglingForms]    = useState<Record<string, boolean>>({});
  const [error,            setError]            = useState<string | null>(null);
  const [formsError,       setFormsError]       = useState<string | null>(null);

  // ── Fetch pages + leads + webhook logs ────────────────────────────────────

  const fetchData = useCallback(async () => {
    setIsLoadingPages(true);
    setError(null);
    try {
      const [pagesRes, leadsRes, logsRes] = await Promise.all([
        fetch("/api/meta/pages"),

        supabase
          .from("leads")
          .select("id, name, contact, email, form_id, form_name, page_id, created_at, source")
          .eq("source", "meta_lead_ads")
          .order("created_at", { ascending: false })
          .limit(10),

        fetch("/api/meta/webhook/logs?limit=20"),
      ]);

      const pagesJson = await pagesRes.json() as { pages?: PageItem[]; hasMetaAccount?: boolean; error?: string };
      if (!pagesRes.ok) throw new Error(pagesJson.error ?? "Erro ao buscar páginas");
      setPages(pagesJson.pages ?? []);
      setHasMetaAccount(pagesJson.hasMetaAccount ?? false);

      setRecentLeads((leadsRes.data ?? []) as Lead[]);

      const logsJson = await logsRes.json() as { logs?: WebhookLogItem[]; error?: string };
      const logs = logsJson.logs ?? [];
      setWebhookLogs(logs);

      // Derive webhook status from recent logs
      if (logs.length === 0) {
        setWebhookStatus("waiting");
      } else {
        const latest = logs[0];
        const ageHours = (Date.now() - new Date(latest.received_at).getTime()) / 3600000;
        if (latest.status === "error" && ageHours < 1) {
          setWebhookStatus("error");
        } else if ((latest.status === "processed" || latest.status === "duplicate") && ageHours < 24) {
          setWebhookStatus("active");
        } else {
          setWebhookStatus("waiting");
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar dados");
    } finally {
      setIsLoadingPages(false);
    }
  }, [supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Fetch forms for selected page ─────────────────────────────────────────

  const fetchForms = useCallback(async (pageId: string) => {
    setIsLoadingForms(true);
    setFormsError(null);
    setForms([]);
    try {
      const res = await fetch(`/api/meta/forms?pageId=${pageId}`);
      const json = await res.json() as { forms?: FormItem[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Erro ao buscar formulários");
      setForms(json.forms ?? []);
    } catch (e: unknown) {
      setFormsError(e instanceof Error ? e.message : "Erro ao buscar formulários");
    } finally {
      setIsLoadingForms(false);
    }
  }, []);

  const handleSelectPage = useCallback((pageId: string | null) => {
    setSelectedPageId(pageId);
    if (pageId) fetchForms(pageId);
    else setForms([]);
  }, [fetchForms]);

  // ── Sync pages ────────────────────────────────────────────────────────────

  const syncPages = useCallback(async () => {
    setIsSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/meta/pages/sync", { method: "POST" });
      const json = await res.json() as { synced?: number; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Erro ao sincronizar");
      await fetchData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao sincronizar");
    } finally {
      setIsSyncing(false);
    }
  }, [fetchData]);

  // ── Toggle form ───────────────────────────────────────────────────────────

  const toggleForm = useCallback(async (
    pageId: string,
    formId: string,
    formName: string,
    active: boolean
  ) => {
    setTogglingForms(p => ({ ...p, [formId]: true }));
    setFormsError(null);
    try {
      const res = await fetch("/api/meta/forms/toggle", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ pageId, formId, formName, active }),
      });
      if (!res.ok) {
        let msg = "Erro ao atualizar formulário";
        try {
          const json = await res.json() as { error?: string };
          if (json.error) msg = json.error;
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      setForms(prev => prev.map(f =>
        f.id === formId ? { ...f, is_subscribed: active } : f
      ));
    } catch (e: unknown) {
      setFormsError(e instanceof Error ? e.message : "Erro ao atualizar formulário");
    } finally {
      setTogglingForms(p => ({ ...p, [formId]: false }));
    }
  }, []);

  // ── Test webhook pipeline ─────────────────────────────────────────────────

  const testWebhook = useCallback(async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/meta/webhook/test", { method: "POST" });
      const json = await res.json() as TestResult;
      setTestResult(json);
    } catch (e: unknown) {
      setTestResult({
        ok: false,
        error: e instanceof Error ? e.message : "Erro ao testar webhook",
      });
    } finally {
      setIsTesting(false);
      // Refresh logs after test
      setTimeout(() => fetchData(), 1500);
    }
  }, [fetchData]);

  const selectedPage = pages.find(p => p.page_id === selectedPageId) ?? null;

  return {
    pages,
    hasMetaAccount,
    selectedPageId,
    selectedPage,
    forms,
    recentLeads,
    webhookLogs,
    webhookStatus,
    isLoadingPages,
    isLoadingForms,
    isSyncing,
    isTesting,
    testResult,
    togglingForms,
    error,
    formsError,
    handleSelectPage,
    syncPages,
    toggleForm,
    testWebhook,
    refetch: fetchData,
  };
}
