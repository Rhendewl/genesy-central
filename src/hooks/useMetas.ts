"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { FinancialGoal, NewFinancialGoal } from "@/types";

interface UseMetasReturn {
  goal: FinancialGoal | null;
  isLoading: boolean;
  error: string | null;
  saveGoal: (data: NewFinancialGoal) => Promise<{ error: string | null }>;
  refetch: () => Promise<void>;
}

export function useMetas(year: number, month: number): UseMetasReturn {
  const [goal, setGoal] = useState<FinancialGoal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      const supabase = getSupabaseClient();

      const { data, error: err } = await supabase
        .from("financial_goals")
        .select("*")
        .eq("year", year)
        .eq("month", month)
        .single();

      if (err && err.code !== "PGRST116") throw err;
      setGoal(data ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao buscar metas");
    } finally {
      setIsLoading(false);
    }
  }, [year, month]);

  useEffect(() => { fetch(); }, [fetch]);

  const saveGoal = useCallback(
    async (data: NewFinancialGoal): Promise<{ error: string | null }> => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error("[useMetas] saveGoal: usuário não autenticado");
          return { error: "Não autenticado" };
        }

        const payload = { ...data, user_id: user.id, year, month };
        console.log("[useMetas] saveGoal payload:", payload);

        const { data: upserted, error: err } = await supabase
          .from("financial_goals")
          .upsert(payload, { onConflict: "user_id,year,month" })
          .select()
          .single();

        if (err) {
          console.error("[useMetas] saveGoal Supabase error:", err);
          throw err;
        }

        console.log("[useMetas] saveGoal sucesso:", upserted);
        await fetch();
        return { error: null };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Erro ao salvar metas";
        console.error("[useMetas] saveGoal exception:", e);
        return { error: msg };
      }
    },
    [year, month, fetch]
  );

  return { goal, isLoading, error, saveGoal, refetch: fetch };
}
