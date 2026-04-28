"use client";

import { useMemo } from "react";
import { startOfDay, subDays, format, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Lead } from "@/types";
import { KANBAN_COLUMNS } from "@/types";

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

export function useLeadsAnalytics(leads: Lead[]): LeadsAnalyticsData {
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
    };
  }, [leads]);
}
