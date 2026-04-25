"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { differenceInDays, parseISO } from "date-fns";
import type { Collection, NewCollection, UpdateCollection } from "@/types";

interface CollectionWithDays extends Collection {
  days_overdue: number;
  severity: "critical" | "warning" | "mild";
}

interface UseInadimplenciaReturn {
  collections: CollectionWithDays[];
  totalInadimplencia: number;
  isLoading: boolean;
  error: string | null;
  createCollection: (data: NewCollection) => Promise<{ error: string | null }>;
  updateCollection: (id: string, data: UpdateCollection) => Promise<{ error: string | null }>;
  markAsPaid: (id: string) => Promise<{ error: string | null }>;
  generateFromOverdueRevenues: () => Promise<{ error: string | null }>;
  refetch: () => Promise<void>;
}

export function useInadimplencia(): UseInadimplenciaReturn {
  const [collections, setCollections] = useState<CollectionWithDays[]>([]);
  const [totalInadimplencia, setTotalInadimplencia] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      const supabase = getSupabaseClient();

      const { data, error: err } = await supabase
        .from("collections")
        .select("*, client:agency_clients(id, name, contact_phone, contact_email), revenue:revenues(id, description, amount)")
        .not("status", "in", '("pago","perdido")')
        .order("due_date");

      if (err) throw err;

      const today = new Date();
      const mapped: CollectionWithDays[] = (data ?? []).map((c: Collection) => {
        const days = differenceInDays(today, parseISO(c.due_date));
        const severity: "critical" | "warning" | "mild" =
          days >= 30 ? "critical" : days >= 8 ? "warning" : "mild";
        return { ...c, days_overdue: Math.max(0, days), severity };
      });

      setCollections(mapped);
      setTotalInadimplencia(mapped.reduce((s, c) => s + c.amount, 0));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao buscar inadimplência");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const createCollection = useCallback(
    async (data: NewCollection): Promise<{ error: string | null }> => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: "Não autenticado" };

        const { error: err } = await supabase
          .from("collections")
          .insert({ ...data, user_id: user.id });
        if (err) throw err;

        await fetch();
        return { error: null };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : "Erro ao criar cobrança" };
      }
    },
    [fetch]
  );

  const updateCollection = useCallback(
    async (id: string, data: UpdateCollection): Promise<{ error: string | null }> => {
      try {
        const supabase = getSupabaseClient();
        const { error: err } = await supabase
          .from("collections")
          .update(data)
          .eq("id", id);
        if (err) throw err;

        await fetch();
        return { error: null };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : "Erro ao atualizar cobrança" };
      }
    },
    [fetch]
  );

  const markAsPaid = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      return updateCollection(id, { status: "pago" });
    },
    [updateCollection]
  );

  // Auto-gerar cobranças de receitas atrasadas
  const generateFromOverdueRevenues = useCallback(async (): Promise<{ error: string | null }> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { error: "Não autenticado" };

      const today = new Date().toISOString().split("T")[0];

      const { data: overdue } = await supabase
        .from("revenues")
        .select("id, client_id, amount, due_date, description")
        .eq("status", "atrasado")
        .lt("due_date", today);

      if (!overdue?.length) return { error: null };

      // Check existing collections to avoid duplicates
      const { data: existing } = await supabase
        .from("collections")
        .select("revenue_id")
        .eq("user_id", user.id);

      const existingIds = new Set((existing ?? []).map((e: { revenue_id: string }) => e.revenue_id));

      const toInsert = overdue
        .filter((r: { id: string }) => !existingIds.has(r.id))
        .map((r: { id: string; client_id: string; amount: number; due_date: string }) => ({
          user_id: user.id,
          client_id: r.client_id,
          revenue_id: r.id,
          amount: Number(r.amount),
          due_date: r.due_date,
          status: "pendente",
        }));

      if (toInsert.length > 0) {
        const { error: err } = await supabase.from("collections").insert(toInsert);
        if (err) throw err;
      }

      await fetch();
      return { error: null };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : "Erro ao gerar cobranças" };
    }
  }, [fetch]);

  return {
    collections,
    totalInadimplencia,
    isLoading,
    error,
    createCollection,
    updateCollection,
    markAsPaid,
    generateFromOverdueRevenues,
    refetch: fetch,
  };
}
