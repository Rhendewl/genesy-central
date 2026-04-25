"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { AgencyClient, NewAgencyClient, UpdateAgencyClient } from "@/types";

interface UseAgencyClientsReturn {
  clients: AgencyClient[];
  isLoading: boolean;
  error: string | null;
  createClient: (data: NewAgencyClient) => Promise<{ error: string | null; id?: string }>;
  updateClient: (id: string, data: UpdateAgencyClient) => Promise<{ error: string | null }>;
  deleteClient: (id: string) => Promise<{ error: string | null }>;
  refetch: () => Promise<void>;
}

export function useAgencyClients(): UseAgencyClientsReturn {
  const [clients, setClients] = useState<AgencyClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const supabase = getSupabaseClient();
      const { data, error: err } = await supabase
        .from("agency_clients")
        .select("*")
        .order("name");
      if (err) throw err;
      setClients(data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao buscar clientes");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const createClient = useCallback(
    async (data: NewAgencyClient): Promise<{ error: string | null; id?: string }> => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error("[useAgencyClients] createClient: usuário não autenticado");
          return { error: "Não autenticado" };
        }

        const payload = { ...data, user_id: user.id };
        console.log("[useAgencyClients] createClient payload:", payload);

        const { data: inserted, error: err } = await supabase
          .from("agency_clients")
          .insert(payload)
          .select()
          .single();

        if (err) {
          console.error("[useAgencyClients] createClient Supabase error:", err);
          throw err;
        }

        console.log("[useAgencyClients] createClient sucesso:", inserted);
        await fetch();
        return { error: null, id: inserted?.id };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Erro ao criar cliente";
        console.error("[useAgencyClients] createClient exception:", e);
        return { error: msg };
      }
    },
    [fetch]
  );

  const updateClient = useCallback(
    async (id: string, data: UpdateAgencyClient): Promise<{ error: string | null }> => {
      try {
        const supabase = getSupabaseClient();
        const { error: err } = await supabase
          .from("agency_clients")
          .update(data)
          .eq("id", id);
        if (err) throw err;

        setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
        return { error: null };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : "Erro ao atualizar cliente" };
      }
    },
    []
  );

  const deleteClient = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      try {
        const supabase = getSupabaseClient();
        const { error: err } = await supabase
          .from("agency_clients")
          .delete()
          .eq("id", id);
        if (err) throw err;

        setClients((prev) => prev.filter((c) => c.id !== id));
        return { error: null };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : "Erro ao excluir cliente" };
      }
    },
    []
  );

  return { clients, isLoading, error, createClient, updateClient, deleteClient, refetch: fetch };
}
