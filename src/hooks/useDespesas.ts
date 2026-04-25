"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { Expense, NewExpense, UpdateExpense } from "@/types";

interface UseDespesasReturn {
  expenses: Expense[];
  isLoading: boolean;
  error: string | null;
  createExpense: (data: NewExpense) => Promise<{ error: string | null }>;
  updateExpense: (id: string, data: UpdateExpense) => Promise<{ error: string | null }>;
  deleteExpense: (id: string) => Promise<{ error: string | null }>;
  importTrafficCosts: (clientId: string | null, amount: number, date: string, campaignName?: string) => Promise<{ error: string | null }>;
  refetch: () => Promise<void>;
}

export function useDespesas(
  monthStart?: string,
  monthEnd?: string
): UseDespesasReturn {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const supabase = getSupabaseClient();

      let query = supabase
        .from("expenses")
        .select("*, client:agency_clients(id, name, status)")
        .order("date", { ascending: false });

      if (monthStart) query = query.gte("date", monthStart);
      if (monthEnd) query = query.lte("date", monthEnd);

      const { data, error: err } = await query;
      if (err) throw err;
      setExpenses((data ?? []) as Expense[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao buscar despesas");
    } finally {
      setIsLoading(false);
    }
  }, [monthStart, monthEnd]);

  useEffect(() => { fetch(); }, [fetch]);

  const createExpense = useCallback(
    async (data: NewExpense): Promise<{ error: string | null }> => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error("[useDespesas] createExpense: usuário não autenticado");
          return { error: "Não autenticado" };
        }

        const payload = { ...data, user_id: user.id };
        console.log("[useDespesas] createExpense payload:", payload);

        const { data: inserted, error: err } = await supabase
          .from("expenses")
          .insert(payload)
          .select()
          .single();

        if (err) {
          console.error("[useDespesas] createExpense Supabase error:", err);
          throw err;
        }

        console.log("[useDespesas] createExpense sucesso:", inserted);
        await fetch();
        return { error: null };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Erro ao criar despesa";
        console.error("[useDespesas] createExpense exception:", e);
        return { error: msg };
      }
    },
    [fetch]
  );

  const updateExpense = useCallback(
    async (id: string, data: UpdateExpense): Promise<{ error: string | null }> => {
      try {
        const supabase = getSupabaseClient();
        const { error: err } = await supabase
          .from("expenses")
          .update(data)
          .eq("id", id);
        if (err) throw err;

        await fetch();
        return { error: null };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : "Erro ao atualizar despesa" };
      }
    },
    [fetch]
  );

  const deleteExpense = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      try {
        const supabase = getSupabaseClient();
        const { error: err } = await supabase
          .from("expenses")
          .delete()
          .eq("id", id);
        if (err) throw err;

        setExpenses((prev) => prev.filter((e) => e.id !== id));
        return { error: null };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : "Erro ao excluir despesa" };
      }
    },
    []
  );

  // Integração automática com tráfego pago
  const importTrafficCosts = useCallback(
    async (
      clientId: string | null,
      amount: number,
      date: string,
      campaignName = "Tráfego Pago"
    ): Promise<{ error: string | null }> => {
      return createExpense({
        client_id: clientId,
        category: "trafego_pago",
        description: campaignName,
        amount,
        date,
        type: "variavel",
        cost_center: null,
        auto_imported: true,
        notes: "Importado automaticamente do módulo de tráfego",
      });
    },
    [createExpense]
  );

  return { expenses, isLoading, error, createExpense, updateExpense, deleteExpense, importTrafficCosts, refetch: fetch };
}
