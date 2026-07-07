"use client";

import { useMemo } from "react";
import { startOfDay, startOfMonth, subDays, format, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Lead } from "@/types";
import { KANBAN_COLUMNS } from "@/types";
import { LeadScoreEngine } from "@/lib/crm/lead-score-engine";
import type { StageHistoryRow, StageOrderRow } from "./useLeadsAnalyticsData";

// ─────────────────────────────────────────────────────────────────────────────
// useLeadsAnalytics
//
// Deriva todas as métricas analíticas do CRM a partir do array de leads já
// carregado — sem nenhuma query adicional ao Supabase.
// ─────────────────────────────────────────────────────────────────────────────

export interface LeadsDayPoint {
  date: string;
  count: number;
}

export interface SourcePoint {
  source: string;
  label: string;
  count: number;
  pct: number;
}

export interface ConversionBySource {
  source: string;
  label: string;
  total: number;
  vendas: number;
  rate: number;
}

export interface FunnelStage {
  id: string;
  label: string;
  color: string;
  count: number;
  pct: number;
}

export interface LeadsInsight {
  type: string;
  title: string;
  description: string;
  color: string;
}

export type ScoreBucket = "0-25" | "26-50" | "51-75" | "76-100";

export interface ScoreBucketPoint {
  range: ScoreBucket;
  count: number;
}

export interface ScoreByGroup {
  key:   string;
  label: string;
  avg:   number;
  count: number;
}

export interface LeadScoreExtreme {
  leadId: string;
  name:   string;
  score:  number;
}

export interface LeadsAnalyticsData {
  todayCount: number;
  last7Count: number;
  last30Count: number;
  growthPct: number | null;
  contactRate: number;
  meetingRate: number;
  saleRate: number;
  leadsPerDay: LeadsDayPoint[];
  sourceBreakdown: SourcePoint[];
  conversionBySource: ConversionBySource[];
  stageFunnel: FunnelStage[];
  insights: LeadsInsight[];
  totalLeads: number;

  // ── IQ (Inteligência de Qualificação) ──────────────────────────────────────
  avgIq:          number | null;
  avgIqByPipeline: ScoreByGroup[];
  avgIqBySource:   ScoreByGroup[];
  avgIqByForm:     ScoreByGroup[];
  iqBuckets:       ScoreBucketPoint[];
  highestIqThisMonth: LeadScoreExtreme | null;
  lowestIqThisMonth:  LeadScoreExtreme | null;

  // ── IE (Índice de Evolução) ────────────────────────────────────────────────
  avgIe:      number | null;
  ieBuckets:  ScoreBucketPoint[];
  avgTimeToIe100Hours:          number | null;
  avgTimeBetweenIeBracketsHours: number | null;
}

const SOURCE_LABELS: Record<string, string> = {
  meta_lead_ads:    "Meta Lead Ads",
  manual:           "Manual",
  external_webhook: "Webhook",
};

function sourceLabel(s: string): string {
  return SOURCE_LABELS[s] ?? s;
}

// Stages considered "qualified contact" (progressed beyond abordados)
const CONTACTED_STAGES = new Set([
  "em_andamento", "formulario_aplicado", "reuniao_agendada",
  "reuniao_realizada", "no_show", "venda_realizada",
]);
const MEETING_STAGES = new Set([
  "reuniao_agendada", "reuniao_realizada", "venda_realizada",
]);

export function bucketOf(score: number): ScoreBucket {
  if (score <= 25) return "0-25";
  if (score <= 50) return "26-50";
  if (score <= 75) return "51-75";
  return "76-100";
}

function emptyBuckets(): ScoreBucketPoint[] {
  return [
    { range: "0-25",   count: 0 },
    { range: "26-50",  count: 0 },
    { range: "51-75",  count: 0 },
    { range: "76-100", count: 0 },
  ];
}

function avgOf(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export function useLeadsAnalytics(
  leads: Lead[],
  stageHistory: StageHistoryRow[] = [],
  stages:       StageOrderRow[]   = [],
): LeadsAnalyticsData {
  return useMemo(() => {
    const now = new Date();
    const todayStart  = startOfDay(now);
    const last7Start  = startOfDay(subDays(now, 6));
    const last30Start = startOfDay(subDays(now, 29));
    const prev30Start = startOfDay(subDays(now, 59));

    const total = leads.length;

    // ── Counts ────────────────────────────────────────────────────────────────

    const todayCount  = leads.filter(l => new Date(l.created_at) >= todayStart).length;
    const last7Count  = leads.filter(l => new Date(l.created_at) >= last7Start).length;
    const last30Count = leads.filter(l => new Date(l.created_at) >= last30Start).length;
    const prev30Count = leads.filter(l => {
      const d = new Date(l.created_at);
      return d >= prev30Start && d < last30Start;
    }).length;

    const growthPct = prev30Count === 0
      ? null
      : ((last30Count - prev30Count) / prev30Count) * 100;

    // ── Rates ─────────────────────────────────────────────────────────────────

    const contactRate = total === 0 ? 0
      : (leads.filter(l => CONTACTED_STAGES.has(l.kanban_column)).length / total) * 100;
    const meetingRate = total === 0 ? 0
      : (leads.filter(l => MEETING_STAGES.has(l.kanban_column)).length / total) * 100;
    const saleRate    = total === 0 ? 0
      : (leads.filter(l => l.kanban_column === "venda_realizada").length / total) * 100;

    // ── Leads per day (last 30 days) ──────────────────────────────────────────

    const leadsPerDay: LeadsDayPoint[] = [];
    for (let i = 29; i >= 0; i--) {
      const day = startOfDay(subDays(now, i));
      const count = leads.filter(l =>
        startOfDay(new Date(l.created_at)).getTime() === day.getTime()
      ).length;
      leadsPerDay.push({ date: format(day, "dd/MM", { locale: ptBR }), count });
    }

    // ── Source breakdown ──────────────────────────────────────────────────────

    const sourceCounts = new Map<string, number>();
    leads.forEach(l => {
      const src = l.source || "manual";
      sourceCounts.set(src, (sourceCounts.get(src) ?? 0) + 1);
    });

    const sourceBreakdown: SourcePoint[] = Array.from(sourceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([src, count]) => ({
        source: src,
        label:  sourceLabel(src),
        count,
        pct: total === 0 ? 0 : Math.round((count / total) * 100),
      }));

    // ── Conversion by source ──────────────────────────────────────────────────

    const sourceVendas = new Map<string, number>();
    leads
      .filter(l => l.kanban_column === "venda_realizada")
      .forEach(l => {
        const src = l.source || "manual";
        sourceVendas.set(src, (sourceVendas.get(src) ?? 0) + 1);
      });

    const conversionBySource: ConversionBySource[] = Array.from(sourceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([src, tot]) => {
        const vendas = sourceVendas.get(src) ?? 0;
        return {
          source: src,
          label:  sourceLabel(src),
          total:  tot,
          vendas,
          rate:   tot === 0 ? 0 : Math.round((vendas / tot) * 100),
        };
      });

    // ── Stage funnel ──────────────────────────────────────────────────────────

    const stageFunnel: FunnelStage[] = KANBAN_COLUMNS.map(col => ({
      id:    col.id,
      label: col.label,
      color: col.color,
      count: leads.filter(l => l.kanban_column === col.id).length,
      pct:   0,
    }));
    const maxCount = Math.max(...stageFunnel.map(s => s.count), 1);
    stageFunnel.forEach(s => { s.pct = Math.round((s.count / maxCount) * 100); });

    // ── Insights ──────────────────────────────────────────────────────────────

    const insights: LeadsInsight[] = [];

    // Best converting source
    const withConversion = conversionBySource.filter(c => c.total >= 3 && c.rate > 0);
    if (withConversion.length > 0) {
      const best = withConversion.reduce((a, b) => b.rate > a.rate ? b : a);
      insights.push({
        type:        "best_source",
        title:       `Melhor fonte: ${best.label}`,
        description: `Taxa de conversão de ${best.rate}% — ${best.vendas} venda${best.vendas > 1 ? "s" : ""} de ${best.total} leads`,
        color:       "#10b981",
      });
    }

    // Leads sem contato há +48h (ainda em novo_lead ou abordados)
    const noContact = leads.filter(l =>
      (l.kanban_column === "novo_lead" || l.kanban_column === "abordados") &&
      differenceInHours(now, new Date(l.created_at)) > 48
    );
    if (noContact.length > 0) {
      insights.push({
        type:        "no_contact",
        title:       `${noContact.length} lead${noContact.length > 1 ? "s" : ""} sem contato há +48h`,
        description: "Parados em Novo Lead ou Abordados — risco de esfriamento",
        color:       "#f59e0b",
      });
    }

    // Maior queda no funil (entre etapas adjacentes)
    const drops = KANBAN_COLUMNS
      .filter((_, i) => i < KANBAN_COLUMNS.length - 1)
      .map((col, i) => {
        const curr = stageFunnel.find(s => s.id === col.id)?.count ?? 0;
        const next = stageFunnel.find(s => s.id === KANBAN_COLUMNS[i + 1].id)?.count ?? 0;
        return {
          from:  col.label,
          to:    KANBAN_COLUMNS[i + 1].label,
          drop:  curr - next,
          curr,
        };
      })
      .filter(d => d.curr > 0 && d.drop > 0);

    if (drops.length > 0) {
      const biggest = drops.reduce((a, b) => b.drop > a.drop ? b : a);
      insights.push({
        type:        "lead_drop",
        title:       `Maior queda: ${biggest.from} → ${biggest.to}`,
        description: `${biggest.drop} lead${biggest.drop > 1 ? "s" : ""} não avançaram nessa transição`,
        color:       "#f43f5e",
      });
    }

    // Dia de pico de entradas
    const dayCounts = new Array(7).fill(0);
    leads.forEach(l => dayCounts[new Date(l.created_at).getDay()]++);
    const peakIdx = dayCounts.indexOf(Math.max(...dayCounts));
    const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    if (total > 0 && dayCounts[peakIdx] > 0) {
      insights.push({
        type:        "peak_day",
        title:       `Pico de entrada: ${DAY_NAMES[peakIdx]}`,
        description: `${dayCounts[peakIdx]} leads entraram às ${DAY_NAMES[peakIdx].toLowerCase()}s no total`,
        color:       "#6366f1",
      });
    }

    // ── IQ (Inteligência de Qualificação) ──────────────────────────────────────

    const iqLeads = leads.filter(l => l.iq_score !== null) as (Lead & { iq_score: number })[];
    const avgIq   = avgOf(iqLeads.map(l => l.iq_score));

    const iqBuckets = emptyBuckets();
    iqLeads.forEach(l => {
      const b = iqBuckets.find(x => x.range === bucketOf(l.iq_score))!;
      b.count++;
    });

    function groupAvg(keyFn: (l: Lead) => string | null, labelFn: (key: string) => string): ScoreByGroup[] {
      const byKey = new Map<string, number[]>();
      iqLeads.forEach(l => {
        const key = keyFn(l);
        if (!key) return;
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key)!.push(l.iq_score);
      });
      return Array.from(byKey.entries())
        .map(([key, scores]) => ({ key, label: labelFn(key), avg: avgOf(scores) ?? 0, count: scores.length }))
        .sort((a, b) => b.avg - a.avg);
    }

    const avgIqByPipeline = groupAvg(l => l.pipeline_id, key => key);
    const avgIqBySource   = groupAvg(l => l.source || "manual", key => sourceLabel(key));
    const avgIqByForm     = groupAvg(l => l.form_id, key =>
      iqLeads.find(l => l.form_id === key)?.form_name ?? key);

    const monthStart = startOfMonth(now);
    const iqThisMonth = iqLeads.filter(l => new Date(l.created_at) >= monthStart);
    const highestIqThisMonth = iqThisMonth.length === 0 ? null : (() => {
      const l = iqThisMonth.reduce((a, b) => b.iq_score > a.iq_score ? b : a);
      return { leadId: l.id, name: l.name, score: l.iq_score };
    })();
    const lowestIqThisMonth = iqThisMonth.length === 0 ? null : (() => {
      const l = iqThisMonth.reduce((a, b) => b.iq_score < a.iq_score ? b : a);
      return { leadId: l.id, name: l.name, score: l.iq_score };
    })();

    // ── IE (Índice de Evolução) ────────────────────────────────────────────────

    const ieLeads = leads.filter(l => l.ie_score !== null) as (Lead & { ie_score: number })[];
    const avgIe   = avgOf(ieLeads.map(l => l.ie_score));

    const ieBuckets = emptyBuckets();
    ieLeads.forEach(l => {
      const b = ieBuckets.find(x => x.range === bucketOf(l.ie_score))!;
      b.count++;
    });

    // Tempo até IE 100 — leads que já chegaram na última etapa não se movem
    // mais, então updated_at (atualizado pela própria RPC de movimentação) É
    // o momento em que chegaram lá. Sem necessidade de olhar o histórico.
    const at100 = ieLeads.filter(l => l.ie_score === 100);
    const avgTimeToIe100Hours = avgOf(
      at100.map(l => differenceInHours(new Date(l.updated_at), new Date(l.created_at)))
    );

    // Tempo médio entre faixas de evolução — reconstrói o IE de cada
    // movimentação histórica (crm_lead_stage_history + order_index da etapa
    // naquele pipeline) e mede o intervalo entre a primeira vez que o lead
    // entra em cada faixa (0-25/26-50/51-75/76-100) e a faixa seguinte.
    const stagesByPipeline = new Map<string, StageOrderRow[]>();
    stages.forEach(s => {
      if (!s.is_active) return;
      if (!stagesByPipeline.has(s.pipeline_id)) stagesByPipeline.set(s.pipeline_id, []);
      stagesByPipeline.get(s.pipeline_id)!.push(s);
    });
    const stageById = new Map(stages.map(s => [s.id, s]));

    const historyByLead = new Map<string, StageHistoryRow[]>();
    stageHistory.forEach(h => {
      if (!historyByLead.has(h.lead_id)) historyByLead.set(h.lead_id, []);
      historyByLead.get(h.lead_id)!.push(h);
    });

    const bracketTransitionHours: number[] = [];
    historyByLead.forEach(rows => {
      const totalActive = stagesByPipeline.get(rows[0]?.pipeline_id ?? "")?.length ?? 0;
      if (totalActive === 0) return;

      let lastBracket: ScoreBucket | null = null;
      let lastBracketEnteredAt: Date | null = null;

      for (const row of rows) {
        const stage = stageById.get(row.stage_id);
        if (!stage) continue;
        const ie = LeadScoreEngine.calculateIE(stage.order_index, totalActive);
        const bracket = bucketOf(ie);
        if (bracket !== lastBracket) {
          if (lastBracketEnteredAt) {
            bracketTransitionHours.push(
              differenceInHours(new Date(row.moved_at), lastBracketEnteredAt)
            );
          }
          lastBracket = bracket;
          lastBracketEnteredAt = new Date(row.moved_at);
        }
      }
    });
    const avgTimeBetweenIeBracketsHours = avgOf(bracketTransitionHours);

    return {
      todayCount,
      last7Count,
      last30Count,
      growthPct,
      contactRate,
      meetingRate,
      saleRate,
      leadsPerDay,
      sourceBreakdown,
      conversionBySource,
      stageFunnel,
      insights,
      totalLeads: total,
      avgIq,
      avgIqByPipeline,
      avgIqBySource,
      avgIqByForm,
      iqBuckets,
      highestIqThisMonth,
      lowestIqThisMonth,
      avgIe,
      ieBuckets,
      avgTimeToIe100Hours,
      avgTimeBetweenIeBracketsHours,
    };
  }, [leads, stageHistory, stages]);
}
