"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { Revenue, NewRevenue, UpdateRevenue } from "@/types";

interface UseReceitasReturn {
  revenues: Revenue[];
  isLoading: boolean;
  error: string | null;
  createRevenue: (data: NewRevenue) => Promise<{ error: string | null }>;
  updateRevenue: (id: string, data: UpdateRevenue) => Promise<{ error: string | null }>;
  deleteRevenue: (id: string) => Promise<{ error: string | null }>;
  markAsPaid: (id: string, paid_date: string) => Promise<{ error: string | null }>;
  refetch: () => Promise<void>;
}

export function useReceitas(
  monthStart?: string,
  monthEnd?: string
): UseReceitasReturn {
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const supabase = getSupabaseClient();

      let query = supabase
        .from("revenues")
        .select("*, client:agency_clients(id, name, status)")
        .order("date", { ascending: false });

      if (monthStart) query = query.gte("date", monthStart);
      if (monthEnd) query = query.lte("date", monthEnd);

      const { data, error: err } = await query;
      if (err) throw err;
      setRevenues((data ?? []) as Revenue[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao buscar receitas");
    } finally {
      setIsLoading(false);
    }
  }, [monthStart, monthEnd]);

  useEffect(() => { fetch(); }, [fetch]);

  const createRevenue = useCallback(
    async (data: NewRevenue): Promise<{ error: string | null }> => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error("[useReceitas] createRevenue: usuário não autenticado");
          return { error: "Não autenticado" };
        }

        const payload = { ...data, user_id: user.id };
        console.log("[useReceitas] createRevenue payload:", payload);

        const { data: inserted, error: err } = await supabase
          .from("revenues")
          .insert(payload)
          .select()
          .single();

        if (err) {
          console.error("[useReceitas] createRevenue Supabase error:", err);
          throw err;
        }

        console.log("[useReceitas] createRevenue sucesso:", inserted);
        await fetch();
        return { error: null };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Erro ao criar receita";
        console.error("[useReceitas] createRevenue exception:", e);
        return { error: msg };
      }
    },
    [fetch]
  );

  const updateRevenue = useCallback(
    async (id: string, data: UpdateRevenue): Promise<{ error: string | null }> => {
      try {
        const supabase = getSupabaseClient();
        console.log("[useReceitas] updateRevenue id:", id, "data:", data);

        const { error: err } = await supabase
          .from("revenues")
          .update(data)
          .eq("id", id);

        if (err) {
          console.error("[useReceitas] updateRevenue error:", err);
          throw err;
        }

        await fetch();
        return { error: null };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Erro ao atualizar receita";
        console.error("[useReceitas] updateRevenue exception:", e);
        return { error: msg };
      }
    },
    [fetch]
  );

  const deleteRevenue = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      try {
        const supabase = getSupabaseClient();
        const { error: err } = await supabase
          .from("revenues")
          .delete()
          .eq("id", id);
        if (err) throw err;

        setRevenues((prev) => prev.filter((r) => r.id !== id));
        return { error: null };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : "Erro ao excluir receita" };
      }
    },
    []
  );

  const markAsPaid = useCallback(
    async (id: string, paid_date: string): Promise<{ error: string | null }> => {
      return updateRevenue(id, { status: "pago", paid_date });
    },
    [updateRevenue]
  );

  return { revenues, isLoading, error, createRevenue, updateRevenue, deleteRevenue, markAsPaid, refetch: fetch };
}
