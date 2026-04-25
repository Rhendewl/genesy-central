"use client";

import { useState, useEffect, useCallback } from "react";
import { format, eachDayOfInterval, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getSupabaseClient } from "@/lib/supabase";
import type {
  TrafficDashboardData, ClientTrafficPerformance,
  CampaignMetric, Campaign, TrafficClientSettings,
} from "@/types";

interface UseTrafegoMetricsReturn {
  dashboard: TrafficDashboardData | null;
  clientPerformance: ClientTrafficPerformance[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTrafegoMetrics(
  year: number,
  month: number,
  platformAccountId?: string | null,
  since?: string | null,
  until?: string | null,
): UseTrafegoMetricsReturn {
  const [dashboard, setDashboard] = useState<TrafficDashboardData | null>(null);
  const [clientPerformance, setClientPerformance] = useState<ClientTrafficPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const supabase = getSupabaseClient();

      let start: string;
      let end: string;

      if (since && until) {
        start = since;
        end = until;
      } else {
        const monthDate = new Date(year, month - 1);
        start = format(startOfMonth(monthDate), "yyyy-MM-dd");
        end = format(endOfMonth(monthDate), "yyyy-MM-dd");
      }

      let metricsQuery = supabase
        .from("campaign_metrics")
        .select("*, campaign:campaigns(id, name, client_id, platform, status)")
        .gte("date", start)
        .lte("date", end);

      if (platformAccountId) metricsQuery = metricsQuery.eq("platform_account_id", platformAccountId);

      let campaignsQuery = supabase
        .from("campaigns")
        .select("*, client:agency_clients(id, name)")
        .eq("status", "ativa");

      if (platformAccountId) campaignsQuery = campaignsQuery.eq("platform_account_id", platformAccountId);

      const [
        { data: metrics },
        { data: campaigns },
        { data: tcsData },
        { data: clients },
      ] = await Promise.all([
        metricsQuery,
        campaignsQuery,
        supabase
          .from("traffic_client_settings")
          .select("*, client:agency_clients(id, name, status, monthly_fee)"),
        supabase
          .from("agency_clients")
          .select("*")
          .eq("status", "ativo"),
      ]);


      const m = (metrics ?? []) as CampaignMetric[];
      const c = (campaigns ?? []) as Campaign[];
      const tcs = (tcsData ?? []) as TrafficClientSettings[];

      // Aggregate KPIs
      const investimento_total = m.reduce((s, x) => s + Number(x.spend), 0);
      const leads_total        = m.reduce((s, x) => s + x.leads, 0);
      const conversoes_total   = m.reduce((s, x) => s + x.conversions, 0);
      const impressoes_total   = m.reduce((s, x) => s + x.impressions, 0);
      const alcance_total      = m.reduce((s, x) => s + x.reach, 0);

      // Prefer link_clicks (inline_link_clicks) for CTR — more meaningful metric.
      // Falls back to total clicks for rows synced before migration 008.
      const cliques_total = m.reduce((s, x) => {
        const lc = x.link_clicks ?? 0;
        return s + (lc > 0 ? lc : x.clicks);
      }, 0);

      const cpl_medio = leads_total > 0 ? investimento_total / leads_total : 0;
      const cpc_medio = cliques_total > 0 ? investimento_total / cliques_total : 0;
      const cpm_medio = impressoes_total > 0 ? (investimento_total / impressoes_total) * 1000 : 0;

      // CTR: use unique_ctr weighted average when available (matches Meta's "CTR Único"),
      // otherwise compute link_clicks / impressions.
      const hasUniqueCtr = m.some(x => (x.unique_ctr ?? 0) > 0);
      const ctr_medio = hasUniqueCtr
        ? (() => {
            const sumWeighted = m.reduce((s, x) => s + (x.unique_ctr ?? 0) * x.impressions, 0);
            return impressoes_total > 0 ? sumWeighted / impressoes_total : 0;
          })()
        : impressoes_total > 0
          ? (cliques_total / impressoes_total) * 100
          : 0;

      const taxa_conversao = leads_total > 0 ? (conversoes_total / leads_total) * 100 : 0;
      const clientes_ativos_midia = new Set(m.map(x => x.client_id).filter(Boolean)).size;
      const campanhas_ativas = c.length;

      // Daily arrays — all days of the range
      const days = eachDayOfInterval({
        start: parseISO(start),
        end: parseISO(end),
      });

      const groupByDay = <T extends keyof CampaignMetric>(
        _field: T,
        reducer: (acc: number, val: CampaignMetric) => number
      ) =>
        days.map(d => {
          const key = format(d, "yyyy-MM-dd");
          const dayMetrics = m.filter(x => x.date === key);
          return {
            data: format(d, "dd/MM", { locale: ptBR }),
            value: dayMetrics.reduce(reducer, 0),
          };
        });

      const investimento_diario = groupByDay("spend", (s, x) => s + Number(x.spend))
        .map(({ data, value }) => ({ data, valor: value }));

      const leads_diario = groupByDay("leads", (s, x) => s + x.leads)
        .map(({ data, value }) => ({ data, leads: value }));

      const conversoes_diario = groupByDay("conversions", (s, x) => s + x.conversions)
        .map(({ data, value }) => ({ data, conversoes: value }));

      const cpl_diario = days.map(d => {
        const key = format(d, "yyyy-MM-dd");
        const dayM = m.filter(x => x.date === key);
        const spend = dayM.reduce((s, x) => s + Number(x.spend), 0);
        const leads = dayM.reduce((s, x) => s + x.leads, 0);
        return { data: format(d, "dd/MM", { locale: ptBR }), cpl: leads > 0 ? spend / leads : 0 };
      });

      // Performance by client
      const clientIds = Array.from(new Set(m.map(x => x.client_id).filter(Boolean))) as string[];

      const performance_clientes = clientIds.map(cid => {
        const cm = m.filter(x => x.client_id === cid);
        const clientName = (clients ?? []).find(cl => cl.id === cid)?.name ?? "Desconhecido";
        const inv = cm.reduce((s, x) => s + Number(x.spend), 0);
        const leads = cm.reduce((s, x) => s + x.leads, 0);
        const convs = cm.reduce((s, x) => s + x.conversions, 0);
        return {
          cliente: clientName,
          investimento: inv,
          leads,
          cpl: leads > 0 ? inv / leads : 0,
          conversoes: convs,
        };
      }).sort((a, b) => b.investimento - a.investimento);

      // Budget distribution
      const totalInv = investimento_total || 1;
      const distribuicao_verba = performance_clientes.map(p => ({
        cliente: p.cliente,
        valor: p.investimento,
        percentual: (p.investimento / totalInv) * 100,
      }));

      // Top campaigns by leads (top 5)
      const campaignIds = Array.from(new Set(m.map(x => x.campaign_id)));
      const top_campanhas = campaignIds.map(campId => {
        const campMetrics = m.filter(x => x.campaign_id === campId);
        const campLeads = campMetrics.reduce((s, x) => s + x.leads, 0);
        const campSpend = campMetrics.reduce((s, x) => s + Number(x.spend), 0);
        const campImps  = campMetrics.reduce((s, x) => s + x.impressions, 0);
        const campClicks = campMetrics.reduce((s, x) => {
          const lc = x.link_clicks ?? 0;
          return s + (lc > 0 ? lc : x.clicks);
        }, 0);
        const campCpl = campLeads > 0 ? campSpend / campLeads : 0;
        const campCtr = campImps > 0 ? (campClicks / campImps) * 100 : 0;
        const campInfo = campMetrics[0]?.campaign as { id?: string; name?: string; status?: string } | undefined;
        return {
          id: campId,
          nome: campInfo?.name ?? campId,
          status: campInfo?.status ?? "desconhecido",
          spend: campSpend,
          leads: campLeads,
          cpl: campCpl,
          ctr: campCtr,
        };
      })
        .sort((a, b) => b.leads - a.leads || a.cpl - b.cpl)
        .slice(0, 5);

      setDashboard({
        investimento_total, leads_total, cpl_medio, cpc_medio, cpm_medio,
        ctr_medio, conversoes_total, taxa_conversao, roas_geral: 0,
        clientes_ativos_midia, campanhas_ativas, impressoes_total,
        cliques_total, alcance_total,
        investimento_diario, leads_diario, cpl_diario, conversoes_diario,
        performance_clientes, distribuicao_verba, top_campanhas,
      });

      // Client performance detail
      const perfDetail: ClientTrafficPerformance[] = clientIds.map(cid => {
        const clientData = (clients ?? []).find(cl => cl.id === cid);
        if (!clientData) return null;

        const cm = m.filter(x => x.client_id === cid);
        const settings = tcs.find(s => s.client_id === cid) ?? null;
        const inv  = cm.reduce((s, x) => s + Number(x.spend), 0);
        const leads = cm.reduce((s, x) => s + x.leads, 0);
        const convs = cm.reduce((s, x) => s + x.conversions, 0);
        const imps  = cm.reduce((s, x) => s + x.impressions, 0);
        const clks  = cm.reduce((s, x) => {
          const lc = x.link_clicks ?? 0;
          return s + (lc > 0 ? lc : x.clicks);
        }, 0);
        const freq  = cm.length > 0 ? cm.reduce((s, x) => s + x.frequency, 0) / cm.length : 0;

        const campIds2 = Array.from(new Set(cm.map(x => x.campaign_id)));
        const campaignStats = campIds2.map(campId => {
          const campMetrics = cm.filter(x => x.campaign_id === campId);
          const campLeads = campMetrics.reduce((s, x) => s + x.leads, 0);
          const campSpend = campMetrics.reduce((s, x) => s + Number(x.spend), 0);
          const campCpl = campLeads > 0 ? campSpend / campLeads : 999999;
          const campName = (campMetrics[0]?.campaign as { name?: string } | undefined)?.name ?? campId;
          return { name: campName, cpl: campCpl, leads: campLeads };
        }).filter(cs => cs.leads > 0);

        const melhor = campaignStats.sort((a, b) => a.cpl - b.cpl)[0]?.name ?? null;
        const pior = campaignStats.sort((a, b) => b.cpl - a.cpl)[0]?.name ?? null;
        const budget = settings?.monthly_budget ?? 0;

        return {
          client: clientData,
          settings,
          investimento: inv,
          leads,
          cpl: leads > 0 ? inv / leads : 0,
          ctr: imps > 0 ? (clks / imps) * 100 : 0,
          conversoes: convs,
          custo_conversao: convs > 0 ? inv / convs : 0,
          impressoes: imps,
          cliques: clks,
          frequencia_media: freq,
          melhor_campanha: melhor,
          pior_campanha: pior,
          budget_utilizado_pct: budget > 0 ? (inv / budget) * 100 : 0,
        };
      }).filter(Boolean) as ClientTrafficPerformance[];

      setClientPerformance(perfDetail.sort((a, b) => b.investimento - a.investimento));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao calcular métricas");
    } finally {
      setIsLoading(false);
    }
  }, [year, month, platformAccountId, since, until]);

  useEffect(() => { fetch(); }, [fetch]);

  return { dashboard, clientPerformance, isLoading, error, refetch: fetch };
}
