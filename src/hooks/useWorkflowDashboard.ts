"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkflowDashboardStats } from "@/lib/workflow-engine/workflow-service";

export interface WorkflowHistoryRow {
  id:            string;
  job_id:        string;
  automation_id: string;
  lead_id:       string;
  status:        "executada" | "cancelada" | "falhou";
  reason:        string | null;
  executed_at:   string;
  workflow_automations: { name?: string; pipeline_id?: string } | null;
  leads:                { name?: string } | null;
}

export function useWorkflowDashboard(pipelineId: string | null) {
  const [stats,     setStats]     = useState<WorkflowDashboardStats | null>(null);
  const [history,   setHistory]   = useState<WorkflowHistoryRow[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<"executada" | "cancelada" | "falhou" | "">("");
  const [page,       setPage]       = useState(1);
  const [isLoading,  setIsLoading]  = useState(true);
  const mountedRef                  = useRef(true);

  const refetch = useCallback(async () => {
    if (!pipelineId) {
      setStats(null);
      setHistory([]);
      return;
    }
    const [statsRes, historyRes] = await Promise.all([
      fetch(`/api/crm/automations/dashboard?pipeline_id=${pipelineId}`),
      fetch(`/api/crm/automations/history?pipeline_id=${pipelineId}&page=${page}${statusFilter ? `&status=${statusFilter}` : ""}`),
    ]);
    const statsJson   = await statsRes.json()   as { stats?: WorkflowDashboardStats };
    const historyJson = await historyRes.json() as { rows?: WorkflowHistoryRow[]; total?: number };

    if (!mountedRef.current) return;
    setStats(statsJson.stats ?? null);
    setHistory(historyJson.rows ?? []);
    setHistoryTotal(historyJson.total ?? 0);
  }, [pipelineId, page, statusFilter]);

  const clearHistory = useCallback(async (): Promise<boolean> => {
    if (!pipelineId) return false;
    const res = await fetch(`/api/crm/automations/history?pipeline_id=${pipelineId}`, { method: "DELETE" });
    if (!res.ok) return false;
    setPage(1);
    await refetch();
    return true;
  }, [pipelineId, refetch]);

  useEffect(() => {
    mountedRef.current = true;
    setIsLoading(true);
    refetch().finally(() => { if (mountedRef.current) setIsLoading(false); });
    return () => { mountedRef.current = false; };
  }, [refetch]);

  return { stats, history, historyTotal, statusFilter, setStatusFilter, page, setPage, isLoading, refetch, clearHistory };
}
