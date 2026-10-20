"use client";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { BscMetric } from "@/lib/workspace/bsc";
export function useBscMetrics(objectiveIds: string[]) {
  const [revision, setRevision] = useState(0);
  const idsKey = [...objectiveIds].sort().join(",");
  const [metrics, setMetrics] = useState<BscMetric[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    let request = 0;
    const db = getSupabaseClient();
    const ids = idsKey ? idsKey.split(",") : [];
    async function load() {
      const version = ++request;
      if (!ids.length) {
        if (active) {
          setMetrics([]);
          setError("");
          setLoading(false);
        }
        return;
      }
      const m = await db
        .from("workspace_objective_metrics")
        .select("*")
        .in("objective_id", ids);
      if (!active || version !== request) return;
      if (m.error) {
        setError(m.error.message);
        setLoading(false);
        return;
      }
      const rows = m.data ?? [];
      if (active && version === request) {
        setMetrics(rows);
        setError("");
        setLoading(false);
      }
    }
    setLoading(true);
    void load();
    const channel = db
      .channel(`bsc-${Math.random()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workspace_objective_metrics" },
        () => void load(),
      )
      .subscribe();
    return () => {
      active = false;
      void db.removeChannel(channel);
    };
  }, [idsKey, revision]);
  return {
    metrics,
    error,
    loading,
    refetch: () => setRevision((r) => r + 1),
  };
}
