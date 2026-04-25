"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { TrafficMonthlyGoal, NewTrafficMonthlyGoal } from "@/types";

interface UseTrafegoMetasReturn {
  goals: TrafficMonthlyGoal[];
  isLoading: boolean;
  error: string | null;
  upsertGoal: (data: NewTrafficMonthlyGoal) => Promise<{ error: string | null }>;
  deleteGoal: (id: string) => Promise<{ error: string | null }>;
  getByClientId: (clientId: string | null) => TrafficMonthlyGoal | undefined;
  refetch: () => Promise<void>;
}

export function useTrafegoMetas(year: number, month: number): UseTrafegoMetasReturn {
  const [goals, setGoals] = useState<TrafficMonthlyGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      const supabase = getSupabaseClient();

      const { data, error: err } = await supabase
        .from("traffic_monthly_goals")
        .select("*, client:agency_clients(id, name)")
        .eq("year", year)
        .eq("month", month);

      if (err) throw err;
      setGoals((data ?? []) as TrafficMonthlyGoal[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao buscar metas");
    } finally {
      setIsLoading(false);
    }
  }, [year, month]);

  useEffect(() => { fetch(); }, [fetch]);

  const upsertGoal = useCallback(
    async (data: NewTrafficMonthlyGoal): Promise<{ error: string | null }> => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: "Não autenticado" };

        const { error: err } = await supabase
          .from("traffic_monthly_goals")
          .upsert(
            { ...data, user_id: user.id },
            { onConflict: "user_id,client_id,year,month" }
          );
        if (err) throw err;
        await fetch();
        return { error: null };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : "Erro ao salvar meta" };
      }
    },
    [fetch]
  );

  const deleteGoal = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      try {
        const supabase = getSupabaseClient();
        const { error: err } = await supabase.from("traffic_monthly_goals").delete().eq("id", id);
        if (err) throw err;
        setGoals(prev => prev.filter(g => g.id !== id));
        return { error: null };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : "Erro ao excluir meta" };
      }
    },
    []
  );

  const getByClientId = useCallback(
    (clientId: string | null) => goals.find(g => g.client_id === clientId),
    [goals]
  );

  return { goals, isLoading, error, upsertGoal, deleteGoal, getByClientId, refetch: fetch };
}
