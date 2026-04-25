"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { Campaign, NewCampaign, UpdateCampaign, CampaignMetric, NewCampaignMetric } from "@/types";

interface UseCampanhasReturn {
  campaigns: Campaign[];
  isLoading: boolean;
  error: string | null;
  createCampaign: (data: NewCampaign) => Promise<{ error: string | null }>;
  updateCampaign: (id: string, data: UpdateCampaign) => Promise<{ error: string | null }>;
  deleteCampaign: (id: string) => Promise<{ error: string | null }>;
  refetch: () => Promise<void>;
}

interface UseCampaignMetricsReturn {
  metrics: CampaignMetric[];
  isLoading: boolean;
  error: string | null;
  upsertMetric: (data: NewCampaignMetric) => Promise<{ error: string | null }>;
  deleteMetric: (id: string) => Promise<{ error: string | null }>;
  refetch: () => Promise<void>;
}

export function useCampanhas(clientId?: string, platformAccountId?: string | null): UseCampanhasReturn {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const supabase = getSupabaseClient();

      let query = supabase
        .from("campaigns")
        .select("*, client:agency_clients(id, name, status, company_type)")
        .order("created_at", { ascending: false });

      if (clientId) query = query.eq("client_id", clientId);
      if (platformAccountId) query = query.eq("platform_account_id", platformAccountId);

      const { data, error: err } = await query;
      if (err) throw err;
      setCampaigns((data ?? []) as Campaign[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao buscar campanhas");
    } finally {
      setIsLoading(false);
    }
  }, [clientId, platformAccountId]);

  useEffect(() => { fetch(); }, [fetch]);

  const createCampaign = useCallback(
    async (data: NewCampaign): Promise<{ error: string | null }> => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: "Não autenticado" };

        const { error: err } = await supabase
          .from("campaigns")
          .insert({ ...data, user_id: user.id });
        if (err) throw err;
        await fetch();
        return { error: null };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : "Erro ao criar campanha" };
      }
    },
    [fetch]
  );

  const updateCampaign = useCallback(
    async (id: string, data: UpdateCampaign): Promise<{ error: string | null }> => {
      try {
        const supabase = getSupabaseClient();
        const { error: err } = await supabase.from("campaigns").update(data).eq("id", id);
        if (err) throw err;
        await fetch();
        return { error: null };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : "Erro ao atualizar campanha" };
      }
    },
    [fetch]
  );

  const deleteCampaign = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      try {
        const supabase = getSupabaseClient();
        const { error: err } = await supabase.from("campaigns").delete().eq("id", id);
        if (err) throw err;
        setCampaigns(prev => prev.filter(c => c.id !== id));
        return { error: null };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : "Erro ao excluir campanha" };
      }
    },
    []
  );

  return { campaigns, isLoading, error, createCampaign, updateCampaign, deleteCampaign, refetch: fetch };
}

export function useCampaignMetrics(
  campaignId?: string,
  monthStart?: string,
  monthEnd?: string
): UseCampaignMetricsReturn {
  const [metrics, setMetrics] = useState<CampaignMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      const supabase = getSupabaseClient();

      let query = supabase
        .from("campaign_metrics")
        .select("*, campaign:campaigns(id, name, platform, status), client:agency_clients(id, name)")
        .order("date", { ascending: false });

      if (campaignId) query = query.eq("campaign_id", campaignId);
      if (monthStart) query = query.gte("date", monthStart);
      if (monthEnd) query = query.lte("date", monthEnd);

      const { data, error: err } = await query;
      if (err) throw err;
      setMetrics((data ?? []) as CampaignMetric[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao buscar métricas");
    } finally {
      setIsLoading(false);
    }
  }, [campaignId, monthStart, monthEnd]);

  useEffect(() => { fetch(); }, [fetch]);

  const upsertMetric = useCallback(
    async (data: NewCampaignMetric): Promise<{ error: string | null }> => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: "Não autenticado" };

        const { error: err } = await supabase
          .from("campaign_metrics")
          .upsert(
            { ...data, user_id: user.id },
            { onConflict: "campaign_id,date" }
          );
        if (err) throw err;

        // Sync to financeiro: create/update expense for traffic
        const { data: campaign } = await supabase
          .from("campaigns")
          .select("name, client_id")
          .eq("id", data.campaign_id)
          .single();

        if (campaign && data.spend > 0) {
          await supabase.from("expenses").upsert(
            {
              user_id: user.id,
              client_id: campaign.client_id,
              category: "trafego_pago",
              description: `[Tráfego] ${campaign.name}`,
              amount: data.spend,
              date: data.date,
              type: "variavel",
              auto_imported: true,
              notes: `Importado automaticamente da campanha: ${campaign.name}`,
            },
            {
              onConflict: "id",
              ignoreDuplicates: false,
            }
          );
        }

        await fetch();
        return { error: null };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : "Erro ao salvar métricas" };
      }
    },
    [fetch]
  );

  const deleteMetric = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      try {
        const supabase = getSupabaseClient();
        const { error: err } = await supabase.from("campaign_metrics").delete().eq("id", id);
        if (err) throw err;
        setMetrics(prev => prev.filter(m => m.id !== id));
        return { error: null };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : "Erro ao excluir métrica" };
      }
    },
    []
  );

  return { metrics, isLoading, error, upsertMetric, deleteMetric, refetch: fetch };
}
