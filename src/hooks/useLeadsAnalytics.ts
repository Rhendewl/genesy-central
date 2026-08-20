"use client";

import { useMemo } from "react";
import { startOfDay, startOfMonth, subDays, format, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Lead } from "@/types";
import { KANBAN_COLUMNS } from "@/types";
import { LeadScoreEngine } from "@/lib/crm/lead-score-engine";
import type { StageHistoryRow, StageOrderRow } from "./useLeadsAnalyticsData";
import type { CrmGoal, CrmStageMetricType } from "@/types/crm";

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
  status: "good" | "attention" | "critical" | "info";
  diagnosis: string;
  action: string;
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
  goalMetrics: CrmGoalMetrics | null;

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

export interface CrmGoalMetrics {
  goal: CrmGoal;
  revenue: number;
  revenueProgress: number;
  progress: number;
  progressLabel: string;
  averageTicket: number;
  sales: number;
  salesNeeded: number | null;
  qualifiedLeads: number;
  meetingsHeld: number;
  meetingsNeeded: number | null;
  meetingsScheduled: number;
  appointmentsNeeded: number | null;
  conversionRate: number;
  attendanceRate: number;
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
  goals:        CrmGoal[]         = [],
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

    // ── Goal metrics based on actual stage movements ─────────────────────────
    const stageById = new Map(stages.map((stage) => [stage.id, stage]));
    const todayKey = format(now, "yyyy-MM-dd");
    const pipelineIdsInView = Array.from(new Set(leads.map((lead) => lead.pipeline_id).filter((id): id is string => Boolean(id))));
    const preferredPipelineId = pipelineIdsInView.length === 1 ? pipelineIdsInView[0] : null;
    const activeGoal = goals
      .filter((goal) => goal.is_active && goal.starts_at <= todayKey && goal.ends_at >= todayKey)
      .sort((a, b) => {
        const aPreferred = a.pipeline_id === preferredPipelineId ? 1 : a.pipeline_id === null ? 0 : -1;
        const bPreferred = b.pipeline_id === preferredPipelineId ? 1 : b.pipeline_id === null ? 0 : -1;
        return bPreferred - aPreferred || b.starts_at.localeCompare(a.starts_at);
      })[0] ?? null;
    let goalMetrics: CrmGoalMetrics | null = null;

    if (activeGoal) {
      const leadIds = new Set(leads.map((lead) => lead.id));
      const movements = stageHistory.filter((row) => {
        const day = row.moved_at.slice(0, 10);
        return leadIds.has(row.lead_id) && day >= activeGoal.starts_at && day <= activeGoal.ends_at;
      });
      const idsFor = (metric: CrmStageMetricType) => new Set(
        movements.filter((row) => stageById.get(row.stage_id)?.metric_type === metric).map((row) => row.lead_id),
      );
      const qualifiedIds = idsFor("qualified_lead");
      const scheduledIds = idsFor("meeting_scheduled");
      const heldIds = idsFor("meeting_held");
      const saleIds = idsFor("sale");
      const revenue = leads.filter((lead) => saleIds.has(lead.id)).reduce((sum, lead) => sum + Number(lead.deal_value || 0), 0);
      const sales = saleIds.size;
      const averageTicket = sales > 0 ? revenue / sales : 0;
      const conversionRate = heldIds.size > 0 ? (sales / heldIds.size) * 100 : 0;
      const attendanceRate = scheduledIds.size > 0 ? (heldIds.size / scheduledIds.size) * 100 : 0;
      const remainingRevenue = Math.max(0, Number(activeGoal.revenue_target || 0) - revenue);
      const salesNeeded = activeGoal.sales_target !== null
        ? Math.max(0, activeGoal.sales_target - sales)
        : activeGoal.revenue_target !== null && averageTicket > 0 ? Math.ceil(remainingRevenue / averageTicket) : null;
      const meetingsNeeded = activeGoal.held_meetings_target !== null
        ? Math.max(0, activeGoal.held_meetings_target - heldIds.size)
        : salesNeeded !== null && conversionRate > 0 ? Math.ceil(salesNeeded / (conversionRate / 100)) : null;
      const appointmentsNeeded = activeGoal.scheduled_meetings_target !== null
        ? Math.max(0, activeGoal.scheduled_meetings_target - scheduledIds.size)
        : meetingsNeeded !== null && attendanceRate > 0 ? Math.ceil(meetingsNeeded / (attendanceRate / 100)) : null;
      const primaryProgress = activeGoal.revenue_target
        ? { value: (revenue / activeGoal.revenue_target) * 100, label: "Progresso da receita" }
        : activeGoal.sales_target
          ? { value: (sales / activeGoal.sales_target) * 100, label: "Progresso de vendas" }
          : activeGoal.held_meetings_target
            ? { value: (heldIds.size / activeGoal.held_meetings_target) * 100, label: "Progresso de comparecimentos" }
            : { value: (scheduledIds.size / Math.max(1, activeGoal.scheduled_meetings_target ?? 1)) * 100, label: "Progresso de agendamentos" };
      goalMetrics = {
        goal: activeGoal,
        revenue,
        revenueProgress: activeGoal.revenue_target ? Math.min(100, (revenue / activeGoal.revenue_target) * 100) : 0,
        progress: Math.min(100, primaryProgress.value),
        progressLabel: primaryProgress.label,
        averageTicket,
        sales,
        salesNeeded,
        qualifiedLeads: qualifiedIds.size,
        meetingsHeld: heldIds.size,
        meetingsNeeded,
        meetingsScheduled: scheduledIds.size,
        appointmentsNeeded,
        conversionRate,
        attendanceRate,
      };
    }

    // ── Insights ──────────────────────────────────────────────────────────────

    const insights: LeadsInsight[] = [];

    if (goalMetrics) {
      const achieved = goalMetrics.progress >= 100;
      insights.push({
        type: "goal_progress",
        title: achieved ? `Meta alcançada: ${goalMetrics.goal.name}` : `Progresso da meta: ${goalMetrics.goal.name}`,
        description: `${goalMetrics.progress.toFixed(0)}% do objetivo principal já foi realizado no período`,
        status: achieved ? "good" : "info",
        diagnosis: "Movimentações nas etapas marcadas como agendamento, comparecimento e venda dentro do período da meta.",
        action: achieved ? "Registre o aprendizado e defina a próxima meta." : "Use as quantidades restantes abaixo para orientar a cadência comercial diária.",
        color: achieved ? "#10b981" : "#3b82f6",
      });
      if (goalMetrics.meetingsScheduled > 0) {
        insights.push({
          type: "goal_attendance",
          title: `Comparecimento: ${goalMetrics.attendanceRate.toFixed(1)}%`,
          description: `${goalMetrics.meetingsHeld} de ${goalMetrics.meetingsScheduled} reuniões agendadas tiveram comparecimento`,
          status: goalMetrics.attendanceRate >= 80 ? "good" : goalMetrics.attendanceRate >= 60 ? "attention" : "critical",
          diagnosis: "Confirmação, lembretes, tempo entre agendamento e reunião e valor percebido antes do encontro.",
          action: goalMetrics.attendanceRate >= 80 ? "Mantenha a cadência de confirmação e replique o processo." : "Revise os no-shows e adote confirmação ativa e lembretes antes da reunião.",
          color: goalMetrics.attendanceRate >= 80 ? "#10b981" : "#f59e0b",
        });
      }
      if (goalMetrics.meetingsHeld > 0) {
        insights.push({
          type: "goal_conversion",
          title: `Conversão de reuniões em vendas: ${goalMetrics.conversionRate.toFixed(1)}%`,
          description: `${goalMetrics.sales} venda${goalMetrics.sales === 1 ? "" : "s"} a partir de ${goalMetrics.meetingsHeld} comparecimento${goalMetrics.meetingsHeld === 1 ? "" : "s"}`,
          status: goalMetrics.sales > 0 ? "good" : "attention",
          diagnosis: "Qualificação antes da reunião, diagnóstico, condução, oferta, preço, objeções e follow-up.",
          action: goalMetrics.sales > 0 ? "Analise as reuniões ganhas e padronize os comportamentos que mais se repetem." : "Revise as reuniões realizadas e identifique a objeção ou quebra mais frequente antes de aumentar o volume.",
          color: goalMetrics.sales > 0 ? "#10b981" : "#f59e0b",
        });
      }
    }

    // Best converting source
    const withConversion = conversionBySource.filter(c => c.total >= 3 && c.rate > 0);
    if (withConversion.length > 0) {
      const best = withConversion.reduce((a, b) => b.rate > a.rate ? b : a);
      insights.push({
        type:        "best_source",
        title:       `Melhor fonte: ${best.label}`,
        description: `Taxa de conversão de ${best.rate}% — ${best.vendas} venda${best.vendas > 1 ? "s" : ""} de ${best.total} leads`,
        status:      "good",
        diagnosis:   "Origem, campanha, anúncio e aderência do público que trouxe esses leads.",
        action:      "Mantenha a fonte ativa e replique a mensagem vencedora, acompanhando se a taxa se sustenta com mais volume.",
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
        status:      "critical",
        diagnosis:   "Fila de atendimento, distribuição por responsável e tempo até a primeira abordagem.",
        action:      "Priorize esses leads agora e defina um SLA de primeiro contato com alertas antes de 48 horas.",
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
      const dropIndex = KANBAN_COLUMNS.findIndex((stage) => stage.label === biggest.from);
      const diagnoses = [
        "Velocidade da primeira abordagem, canal usado e qualidade dos dados de contato.",
        "Mensagem inicial, proposta de valor, oferta e qualificação do público.",
        "Cadência de follow-up, objeções recorrentes e clareza do próximo passo.",
        "Qualificação, fricção do formulário e chamada para agendar a reunião.",
        "Compromisso, confirmação, lembretes e valor percebido antes da reunião.",
        "Diagnóstico, condução da reunião, oferta, preço e negociação.",
        "Recuperação de no-show, nova tentativa de agenda e follow-up comercial.",
      ];
      insights.push({
        type:        "lead_drop",
        title:       `Maior queda: ${biggest.from} → ${biggest.to}`,
        description: `${biggest.drop} lead${biggest.drop > 1 ? "s" : ""} não avançaram nessa transição`,
        status:      "attention",
        diagnosis:   diagnoses[dropIndex] ?? "Processo, responsável e motivo de perda nesta transição.",
        action:      "Revise uma amostra dos leads parados, identifique o motivo dominante e teste uma melhoria específica nesta etapa.",
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
        status:      "info",
        diagnosis:   "Campanhas, conteúdos e canais que concentram entradas nesse dia.",
        action:      "Garanta capacidade de atendimento no pico e programe campanhas e conteúdos fortes pouco antes dele.",
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
      goalMetrics,
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
  }, [leads, stageHistory, stages, goals]);
}
