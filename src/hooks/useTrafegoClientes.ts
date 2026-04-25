"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { TrafficClientSettings, NewTrafficClientSettings, UpdateTrafficClientSettings } from "@/types";

interface UseTrafegoClientesReturn {
  settings: TrafficClientSettings[];
  isLoading: boolean;
  error: string | null;
  upsertSettings: (clientId: string, data: Partial<NewTrafficClientSettings>) => Promise<{ error: string | null }>;
  deleteSettings: (id: string) => Promise<{ error: string | null }>;
  getByClientId: (clientId: string) => TrafficClientSettings | undefined;
  refetch: () => Promise<void>;
}

export function useTrafegoClientes(): UseTrafegoClientesReturn {
  const [settings, setSettings] = useState<TrafficClientSettings[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const supabase = getSupabaseClient();

      const { data, error: err } = await supabase
        .from("traffic_client_settings")
        .select("*, client:agency_clients(id, name, status, company_type, monthly_fee, contact_phone, contact_email)")
        .order("created_at");

      if (err) throw err;
      setSettings((data ?? []) as TrafficClientSettings[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao buscar configurações");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const upsertSettings = useCallback(
    async (clientId: string, data: Partial<NewTrafficClientSettings>): Promise<{ error: string | null }> => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: "Não autenticado" };

        const { error: err } = await supabase
          .from("traffic_client_settings")
          .upsert(
            { ...data, user_id: user.id, client_id: clientId },
            { onConflict: "user_id,client_id" }
          );
        if (err) throw err;
        await fetch();
        return { error: null };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : "Erro ao salvar configurações" };
      }
    },
    [fetch]
  );

  const deleteSettings = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      try {
        const supabase = getSupabaseClient();
        const { error: err } = await supabase
          .from("traffic_client_settings")
          .delete()
          .eq("id", id);
        if (err) throw err;
        setSettings(prev => prev.filter(s => s.id !== id));
        return { error: null };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : "Erro ao remover cliente" };
      }
    },
    []
  );

  const getByClientId = useCallback(
    (clientId: string) => settings.find(s => s.client_id === clientId),
    [settings]
  );

  return { settings, isLoading, error, upsertSettings, deleteSettings, getByClientId, refetch: fetch };
}
