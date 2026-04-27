"use client";

import { useMemo } from "react";
import {
  parseISO, startOfMonth, endOfMonth, differenceInMonths,
  format, subMonths, addMonths, isBefore, isAfter, isWithinInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { AgencyClient } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// useSaudeOperacao — Retention, Churn & Health Metrics
// ─────────────────────────────────────────────────────────────────────────────

export interface MonthlyEvolution {
  mes: string;           // "jan", "fev"...
  ativos: number;
  cancelamentos: number;
  churn_pct: number;
  retencao_pct: number;
  mrr: number;
}

export interface CohortRow {
  mes: string;           // "Jan/24"
  entradas: number;
  apos_1m: number;
  apos_3m: number;
  apos_6m: number;
  apos_1m_pct: number;
  apos_3m_pct: number;
  apos_6m_pct: number;
}

export interface ChurnedClientRow {
  client: AgencyClient;
  tempo_meses: number;
  receita_total: number;
}

export interface SaudeInsight {
  id: string;
  type: "positive" | "warning" | "critical" | "neutral";
  title: string;
  message: string;
}

export interface SaudeMetrics {
  // KPIs
  ltv: number;
  avg_permanence_months: number;
  churn_rate: number;
  retention_rate: number;
  churned_count: number;
  active_count: number;
  mrr: number;
  avg_ticket: number;
  mrr_lost: number;
  mrr_net_growth: number;

  // Charts
  monthly_evolution: MonthlyEvolution[];
  cohort: CohortRow[];

  // Table
  churned_clients: ChurnedClientRow[];
  at_risk_clients: AgencyClient[];

  // Insights
  insights: SaudeInsight[];

  isLoading: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isActiveInMonth(c: AgencyClient, y: number, m: number): boolean {
  if (!c.contract_start) return false;
  const mStart = startOfMonth(new Date(y, m - 1, 1));
  const mEnd = endOfMonth(mStart);
  const cStart = parseISO(c.contract_start);
  if (isAfter(cStart, mEnd)) return false;
  if (!c.contract_end) return true;
  const cEnd = parseISO(c.contract_end);
  return !isBefore(cEnd, mStart);
}

function churnedInMonth(c: AgencyClient, y: number, m: number): boolean {
  if (!c.contract_end) return false;
  const mStart = startOfMonth(new Date(y, m - 1, 1));
  const mEnd = endOfMonth(mStart);
  const cEnd = parseISO(c.contract_end);
  return isWithinInterval(cEnd, { start: mStart, end: mEnd });
}

function clientPermanenceMonths(c: AgencyClient): number {
  if (!c.contract_start) return 0;
  const start = parseISO(c.contract_start);
  const end = c.contract_end ? parseISO(c.contract_end) : new Date();
  return Math.max(0, differenceInMonths(end, start));
}

function isActiveAfterNMonths(c: AgencyClient, n: number): boolean {
  if (!c.contract_start) return false;
  const threshold = addMonths(parseISO(c.contract_start), n);
  if (!c.contract_end) return true;
  return isAfter(parseISO(c.contract_end), threshold);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSaudeOperacao(
  clients: AgencyClient[],
  year: number,
  month: number,
  isLoading: boolean
): SaudeMetrics {
  return useMemo(() => {
    const now = new Date();
    const periodStart = startOfMonth(new Date(year, month - 1, 1));

    // ── Active & churned counts ──────────────────────────────────────────────
    const currentActive = clients.filter(c => c.status === "ativo");
    const allChurned = clients.filter(
      c => (c.status === "churned" || c.status === "inativo") && c.contract_end
    );

    const activeCount = currentActive.length;
    const mrr = currentActive.reduce((s, c) => s + c.monthly_fee, 0);
    const avgTicket = activeCount > 0 ? mrr / activeCount : 0;

    // ── Average permanence ───────────────────────────────────────────────────
    const churnedPermanences = allChurned
      .map(c => clientPermanenceMonths(c))
      .filter(m => m > 0);

    const avgChurnedPermanence =
      churnedPermanences.length > 0
        ? churnedPermanences.reduce((a, b) => a + b, 0) / churnedPermanences.length
        : 0;

    const activePermanences = currentActive
      .filter(c => c.contract_start)
      .map(c => clientPermanenceMonths(c));

    const avgActivePermanence =
      activePermanences.length > 0
        ? activePermanences.reduce((a, b) => a + b, 0) / activePermanences.length
        : 0;

    // Use churned permanence if available, else active as proxy
    const avgPermanenceMonths =
      avgChurnedPermanence > 0
        ? avgChurnedPermanence
        : avgActivePermanence;

    // ── LTV ──────────────────────────────────────────────────────────────────
    const ltv = avgTicket * (avgPermanenceMonths > 0 ? avgPermanenceMonths : 1);

    // ── Churn rate (period) ──────────────────────────────────────────────────
    const prevM = month === 1 ? 12 : month - 1;
    const prevY = month === 1 ? year - 1 : year;
    const activeAtStartOfPeriod = clients.filter(c => isActiveInMonth(c, prevY, prevM)).length;
    const churnedInPeriod = clients.filter(c => churnedInMonth(c, year, month));
    const churnedCount = churnedInPeriod.length;
    const churnRate =
      activeAtStartOfPeriod > 0 ? (churnedCount / activeAtStartOfPeriod) * 100 : 0;
    const retentionRate = 100 - churnRate;

    // ── MRR metrics ──────────────────────────────────────────────────────────
    const mrrLost = churnedInPeriod.reduce((s, c) => s + c.monthly_fee, 0);
    // New clients this period
    const newInPeriod = clients.filter(c => {
      if (!c.contract_start) return false;
      return isWithinInterval(parseISO(c.contract_start), {
        start: periodStart,
        end: endOfMonth(periodStart),
      });
    });
    const mrrNew = newInPeriod.reduce((s, c) => s + c.monthly_fee, 0);
    const mrrNetGrowth = mrrNew - mrrLost;

    // ── Monthly evolution (last 6 months) ────────────────────────────────────
    const monthly_evolution: MonthlyEvolution[] = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(periodStart, 5 - i);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const active = clients.filter(c => isActiveInMonth(c, y, m)).length;
      const canceled = clients.filter(c => churnedInMonth(c, y, m)).length;
      const prevMonth = m === 1 ? 12 : m - 1;
      const prevYear = m === 1 ? y - 1 : y;
      const prevActive = clients.filter(c => isActiveInMonth(c, prevYear, prevMonth)).length;
      const churnPct = prevActive > 0 ? (canceled / prevActive) * 100 : 0;
      const mrrMonth = clients
        .filter(c => isActiveInMonth(c, y, m))
        .reduce((s, c) => s + c.monthly_fee, 0);
      return {
        mes: format(d, "MMM", { locale: ptBR }),
        ativos: active,
        cancelamentos: canceled,
        churn_pct: parseFloat(churnPct.toFixed(1)),
        retencao_pct: parseFloat((100 - churnPct).toFixed(1)),
        mrr: mrrMonth,
      };
    });

    // ── Cohort (last 6 entry months) ─────────────────────────────────────────
    const cohort: CohortRow[] = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, 5 - i);
      const cohortStart = startOfMonth(d);
      const cohortEnd = endOfMonth(d);
      const cohortClients = clients.filter(c => {
        if (!c.contract_start) return false;
        return isWithinInterval(parseISO(c.contract_start), {
          start: cohortStart,
          end: cohortEnd,
        });
      });
      const n = cohortClients.length;
      const after1 = cohortClients.filter(c => isActiveAfterNMonths(c, 1)).length;
      const after3 = cohortClients.filter(c => isActiveAfterNMonths(c, 3)).length;
      const after6 = cohortClients.filter(c => isActiveAfterNMonths(c, 6)).length;
      return {
        mes: format(d, "MMM/yy", { locale: ptBR }),
        entradas: n,
        apos_1m: after1,
        apos_3m: after3,
        apos_6m: after6,
        apos_1m_pct: n > 0 ? (after1 / n) * 100 : 0,
        apos_3m_pct: n > 0 ? (after3 / n) * 100 : 0,
        apos_6m_pct: n > 0 ? (after6 / n) * 100 : 0,
      };
    });

    // ── Churned clients table ────────────────────────────────────────────────
    const churned_clients: ChurnedClientRow[] = allChurned.map(c => ({
      client: c,
      tempo_meses: clientPermanenceMonths(c),
      receita_total: c.monthly_fee * clientPermanenceMonths(c),
    }));

    // ── At risk clients (contract_end within 60 days) ────────────────────────
    const in60Days = addMonths(now, 2);
    const at_risk_clients = currentActive.filter(c => {
      if (!c.contract_end) return false;
      const end = parseISO(c.contract_end);
      return isAfter(end, now) && isBefore(end, in60Days);
    });

    // ── Insights ─────────────────────────────────────────────────────────────
    const insights: SaudeInsight[] = [];

    // Compare current churn with previous month
    const prevPrevM = prevM === 1 ? 12 : prevM - 1;
    const prevPrevY = prevM === 1 ? prevY - 1 : prevY;
    const activeAtStartPrev = clients.filter(c =>
      isActiveInMonth(c, prevPrevY, prevPrevM)
    ).length;
    const churnedPrev = clients.filter(c => churnedInMonth(c, prevY, prevM)).length;
    const churnRatePrev =
      activeAtStartPrev > 0 ? (churnedPrev / activeAtStartPrev) * 100 : 0;

    if (churnRate > churnRatePrev + 2 && churnRate > 5) {
      insights.push({
        id: "churn_up",
        type: "warning",
        title: "Churn aumentou este mês",
        message: `Taxa de churn subiu de ${churnRatePrev.toFixed(1)}% para ${churnRate.toFixed(1)}% em relação ao mês anterior.`,
      });
    } else if (churnRate < churnRatePrev - 2 && churnRatePrev > 0) {
      insights.push({
        id: "retention_up",
        type: "positive",
        title: "Retenção melhorou",
        message: `Churn caiu de ${churnRatePrev.toFixed(1)}% para ${churnRate.toFixed(1)}%. Boa tendência de retenção.`,
      });
    }

    if (churnRate > 10) {
      insights.push({
        id: "churn_critical",
        type: "critical",
        title: "Churn acima do limite saudável",
        message: `${churnRate.toFixed(1)}% de churn neste período. Referência saudável: abaixo de 5%.`,
      });
    }

    if (churnedCount === 0 && activeCount > 0) {
      insights.push({
        id: "no_churn",
        type: "positive",
        title: "Base estável",
        message: "Nenhum cancelamento registrado neste período. Operação saudável.",
      });
    }

    // High value churn
    const highValueChurned = churnedInPeriod.filter(c => c.monthly_fee >= avgTicket * 1.5);
    if (highValueChurned.length > 0) {
      insights.push({
        id: "high_value_churn",
        type: "critical",
        title: "Cliente de alto valor cancelado",
        message: `${highValueChurned.map(c => c.name).join(", ")} encerrou contrato. Impacto de ${
          new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
            .format(highValueChurned.reduce((s, c) => s + c.monthly_fee, 0))
        }/mês.`,
      });
    }

    // Concentration risk: top 3 clients > 60% MRR
    if (activeCount >= 3 && mrr > 0) {
      const sorted = [...currentActive].sort((a, b) => b.monthly_fee - a.monthly_fee);
      const top3 = sorted.slice(0, 3).reduce((s, c) => s + c.monthly_fee, 0);
      const concentration = (top3 / mrr) * 100;
      if (concentration > 60) {
        insights.push({
          id: "concentration_risk",
          type: "warning",
          title: "Risco de concentração de receita",
          message: `Os 3 maiores clientes representam ${concentration.toFixed(0)}% do MRR. Alta dependência de poucos clientes.`,
        });
      }
    }

    // At risk
    if (at_risk_clients.length > 0) {
      insights.push({
        id: "at_risk",
        type: "warning",
        title: `${at_risk_clients.length} contrato${at_risk_clients.length > 1 ? "s" : ""} vencendo em 60 dias`,
        message: `${at_risk_clients.map(c => c.name).join(", ")} com contrato próximo ao vencimento.`,
      });
    }

    // LTV growth (if good permanence)
    if (avgPermanenceMonths >= 12) {
      insights.push({
        id: "ltv_healthy",
        type: "positive",
        title: "LTV saudável",
        message: `Permanência média de ${avgPermanenceMonths.toFixed(0)} meses indica boa retenção da carteira.`,
      });
    }

    // Net MRR growth
    if (mrrNetGrowth > 0) {
      insights.push({
        id: "mrr_growth",
        type: "positive",
        title: "MRR crescendo",
        message: `Crescimento líquido de ${
          new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
            .format(mrrNetGrowth)
        } no MRR este mês.`,
      });
    }

    return {
      ltv,
      avg_permanence_months: avgPermanenceMonths,
      churn_rate: churnRate,
      retention_rate: retentionRate,
      churned_count: churnedCount,
      active_count: activeCount,
      mrr,
      avg_ticket: avgTicket,
      mrr_lost: mrrLost,
      mrr_net_growth: mrrNetGrowth,
      monthly_evolution,
      cohort,
      churned_clients,
      at_risk_clients,
      insights,
      isLoading,
    };
  }, [clients, year, month, isLoading]);
}
