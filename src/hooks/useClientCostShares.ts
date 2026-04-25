"use client";

import { useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { ClientCostShare } from "@/types";

export interface CostShareDraft {
  name: string;
  percentage: number;
}

export function useClientCostShares() {
  const getByClientId = useCallback(async (clientId: string): Promise<ClientCostShare[]> => {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("client_cost_shares")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at");
    return data ?? [];
  }, []);

  const saveShares = useCallback(async (
    clientId: string,
    shares: CostShareDraft[],
  ): Promise<{ error: string | null }> => {
    const supabase = getSupabaseClient();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { error: "Não autenticado" };

      // Replace all existing shares for this client atomically
      const { error: delErr } = await supabase
        .from("client_cost_shares")
        .delete()
        .eq("client_id", clientId);
      if (delErr) return { error: delErr.message };

      const toInsert = shares.filter(s => s.name.trim() !== "" && s.percentage >= 0);
      if (toInsert.length > 0) {
        const { error: insErr } = await supabase
          .from("client_cost_shares")
          .insert(toInsert.map(s => ({
            client_id: clientId,
            user_id: user.id,
            name: s.name.trim(),
            percentage: s.percentage,
          })));
        if (insErr) return { error: insErr.message };
      }
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Erro ao salvar parceiros" };
    }
  }, []);

  return { getByClientId, saveShares };
}
