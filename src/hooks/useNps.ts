"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { format } from "date-fns";
import type {
  NpsRecord, NewNpsRecord, UpdateNpsRecord,
  AgencyClient, NpsClassification,
} from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// useNps — NPS Records + Computed Metrics
// ─────────────────────────────────────────────────────────────────────────────

export function classifyNps(score: number): NpsClassification {
  if (score >= 9) return "promotor";
  if (score >= 7) return "neutro";
  return "detrator";
}

export function npsScoreLabel(nps: number): string {
  if (nps >= 75)  return "Excelente";
  if (nps >= 50)  return "Muito Bom";
  if (nps >= 0)   return "Bom";
  return "Crítico";
}

export function npsScoreColor(nps: number): string {
  if (nps >= 75)  return "#10b981";
  if (nps >= 50)  return "#4a8fd4";
  if (nps >= 0)   return "#f59e0b";
  return "#ef4444";
}

export function avgScoreLabel(avg: number): string {
  if (avg >= 9) return "Excelente";
  if (avg >= 7) return "Muito Bom";
  if (avg >= 5) return "Bom";
  return "Crítico";
}

export function avgScoreColor(avg: number): string {
  if (avg >= 9) return "#10b981";
  if (avg >= 7) return "#4a8fd4";
  if (avg >= 5) return "#f59e0b";
  return "#ef4444";
}

// ── Per-client aggregated view ────────────────────────────────────────────────

export interface ClientNpsSummary {
  client: AgencyClient;
  lastScore: number | null;
  lastMonth: string | null;
  avgScore: number;
  classification: NpsClassification | null;
  trend: "up" | "down" | "stable" | null;
  records: NpsRecord[];
}

export interface NpsMonthlyPoint {
  mes: string;
  nps: number;
  promotores: number;
  neutros: number;
  detratores: number;
  total: number;
}

export interface NpsInsight {
  id: string;
  type: "positive" | "warning" | "critical" | "neutral";
  title: string;
  message: string;
}

export interface NpsMetrics {
  npsScore: number;
  npsLabel: string;
  avgScore: number;
  pctPromoters: number;
  pctNeutrals: number;
  pctDetractors: number;
  respondedCount: number;
  notRespondedCount: number;
  biggestRise: { client: AgencyClient; delta: number } | null;
  biggestFall: { client: AgencyClient; delta: number } | null;
  monthlyEvolution: NpsMonthlyPoint[];
  clientSummaries: ClientNpsSummary[];
  insights: NpsInsight[];
  periodRecords: NpsRecord[];
}

// ── Hook ──────────────────────────────────────────────────────────────────────

interface UseNpsReturn {
  records: NpsRecord[];
  clients: AgencyClient[];
  isLoading: boolean;
  error: string | null;
  metrics: NpsMetrics;
  createRecord: (data: NewNpsRecord) => Promise<{ error: string | null }>;
  updateRecord: (id: string, data: UpdateNpsRecord) => Promise<{ error: string | null }>;
  deleteRecord: (id: string) => Promise<{ error: string | null }>;
  refetch: () => Promise<void>;
}

export function useNps(year: number, month: number): UseNpsReturn {
  const [records, setRecords] = useState<NpsRecord[]>([]);
  const [clients, setClients] = useState<AgencyClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const supabase = getSupabaseClient();

      const [npsRes, clientsRes] = await Promise.all([
        supabase
          .from("nps_records")
          .select("*, client:agency_clients(id, name, status, monthly_fee, contract_start, contract_end, company_type, contact_name, contact_email, contact_phone, notes, payment_day, user_id, created_at, updated_at)")
          .order("created_at", { ascending: false }),
        supabase
          .from("agency_clients")
          .select("*")
          .order("name"),
      ]);

      if (npsRes.error) throw npsRes.error;
      if (clientsRes.error) throw clientsRes.error;

      setRecords(npsRes.data ?? []);
      setClients(clientsRes.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao buscar NPS");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const metrics = useMemo<NpsMetrics>(() => {
    const refMonth = format(new Date(year, month - 1, 1), "yyyy-MM");

    // Records for current period
    const periodRecords = records.filter(r => r.reference_month === refMonth);

    // NPS calculation
    const total = periodRecords.length;
    const promoters  = periodRecords.filter(r => classifyNps(r.score) === "promotor").length;
    const neutrals   = periodRecords.filter(r => classifyNps(r.score) === "neutro").length;
    const detractors = periodRecords.filter(r => classifyNps(r.score) === "detrator").length;

    const pctPromoters  = total > 0 ? (promoters / total) * 100 : 0;
    const pctNeutrals   = total > 0 ? (neutrals / total) * 100 : 0;
    const pctDetractors = total > 0 ? (detractors / total) * 100 : 0;
    const npsScore      = total > 0 ? pctPromoters - pctDetractors : 0;
    const avgScore      = total > 0 ? periodRecords.reduce((s, r) => s + r.score, 0) / total : 0;

    // Active clients with no response this month
    const activeClients = clients.filter(c => c.status === "ativo");
    const respondedIds  = new Set(periodRecords.map(r => r.client_id));
    const respondedCount    = respondedIds.size;
    const notRespondedCount = activeClients.filter(c => !respondedIds.has(c.id)).length;

    // Per-client summaries
    const clientSummaries: ClientNpsSummary[] = activeClients.map(c => {
      const clientRecords = records
        .filter(r => r.client_id === c.id)
        .sort((a, b) => b.reference_month.localeCompare(a.reference_month));
      const last = clientRecords[0] ?? null;
      const prev = clientRecords[1] ?? null;
      const avgScore = clientRecords.length > 0
        ? clientRecords.reduce((s, r) => s + r.score, 0) / clientRecords.length
        : 0;
      let trend: ClientNpsSummary["trend"] = null;
      if (last && prev) {
        trend = last.score > prev.score ? "up" : last.score < prev.score ? "down" : "stable";
      }
      return {
        client: c,
        lastScore: last?.score ?? null,
        lastMonth: last?.reference_month ?? null,
        avgScore,
        classification: last ? classifyNps(last.score) : null,
        trend,
        records: clientRecords,
      };
    });

    // Biggest rise / fall this month vs previous
    const prevMonth = format(new Date(year, month - 2, 1), "yyyy-MM");
    let biggestRise: NpsMetrics["biggestRise"] = null;
    let biggestFall: NpsMetrics["biggestFall"] = null;

    for (const cs of clientSummaries) {
      const curr = periodRecords.find(r => r.client_id === cs.client.id);
      const prev = records.find(
        r => r.client_id === cs.client.id && r.reference_month === prevMonth
      );
      if (!curr || !prev) continue;
      const delta = curr.score - prev.score;
      if (delta > 0 && (!biggestRise || delta > biggestRise.delta)) {
        biggestRise = { client: cs.client, delta };
      }
      if (delta < 0 && (!biggestFall || delta < biggestFall.delta)) {
        biggestFall = { client: cs.client, delta };
      }
    }

    // Monthly evolution (last 6 months)
    const monthlyEvolution: NpsMonthlyPoint[] = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(year, month - 1 - (5 - i), 1);
      const key = format(d, "yyyy-MM");
      const monthRecs = records.filter(r => r.reference_month === key);
      const t = monthRecs.length;
      const p = monthRecs.filter(r => classifyNps(r.score) === "promotor").length;
      const n = monthRecs.filter(r => classifyNps(r.score) === "neutro").length;
      const dt = monthRecs.filter(r => classifyNps(r.score) === "detrator").length;
      const nps = t > 0 ? ((p / t) - (dt / t)) * 100 : 0;
      return {
        mes: format(d, "MMM", { locale: undefined }),
        nps: parseFloat(nps.toFixed(1)),
        promotores: t > 0 ? parseFloat(((p / t) * 100).toFixed(1)) : 0,
        neutros:    t > 0 ? parseFloat(((n / t) * 100).toFixed(1)) : 0,
        detratores: t > 0 ? parseFloat(((dt / t) * 100).toFixed(1)) : 0,
        total: t,
      };
    });

    // Insights
    const insights: NpsInsight[] = [];

    if (total === 0) {
      insights.push({
        id: "no_data",
        type: "neutral",
        title: "Sem registros este mês",
        message: "Registre as notas NPS dos clientes para visualizar a saúde da satisfação da carteira.",
      });
    }

    if (npsScore >= 75) {
      insights.push({ id: "nps_excellent", type: "positive", title: "NPS Excelente", message: `Score de ${npsScore.toFixed(0)} pontos. A carteira está altamente satisfeita.` });
    } else if (npsScore < 0) {
      insights.push({ id: "nps_critical", type: "critical", title: "NPS Negativo", message: `Score de ${npsScore.toFixed(0)} pontos. Mais detratores que promotores. Ação urgente recomendada.` });
    }

    if (detractors >= 3) {
      insights.push({ id: "detractors", type: "critical", title: `${detractors} detratores este mês`, message: "Alto número de clientes insatisfeitos. Verifique os comentários e entre em contato." });
    }

    if (biggestFall && biggestFall.delta <= -3) {
      insights.push({
        id: "biggest_fall",
        type: "warning",
        title: `Queda de ${Math.abs(biggestFall.delta)} pontos`,
        message: `${biggestFall.client.name} caiu de ${records.find(r => r.client_id === biggestFall!.client.id && r.reference_month === prevMonth)?.score ?? "—"} para ${periodRecords.find(r => r.client_id === biggestFall!.client.id)?.score ?? "—"}.`,
      });
    }

    if (biggestRise && biggestRise.delta >= 2) {
      insights.push({
        id: "biggest_rise",
        type: "positive",
        title: `Alta de ${biggestRise.delta} pontos`,
        message: `${biggestRise.client.name} subiu para nota ${periodRecords.find(r => r.client_id === biggestRise!.client.id)?.score ?? "—"} este mês.`,
      });
    }

    // Upsell: promoters with score 10
    const promotersPerfect = periodRecords.filter(r => r.score === 10);
    if (promotersPerfect.length > 0) {
      insights.push({
        id: "upsell",
        type: "positive",
        title: `${promotersPerfect.length} cliente${promotersPerfect.length > 1 ? "s" : ""} com nota 10`,
        message: `${promotersPerfect.map(r => r.client?.name ?? "—").join(", ")} — potencial para upsell ou indicação.`,
      });
    }

    // Clients without response for 2+ months
    const twoMonthsAgo = format(new Date(year, month - 3, 1), "yyyy-MM");
    const silent = activeClients.filter(c => {
      const lastRecord = records.find(r => r.client_id === c.id);
      if (!lastRecord) return true;
      return lastRecord.reference_month < twoMonthsAgo;
    });
    if (silent.length > 0) {
      insights.push({
        id: "no_response",
        type: "warning",
        title: `${silent.length} cliente${silent.length > 1 ? "s" : ""} sem NPS há 2+ meses`,
        message: `${silent.slice(0, 3).map(c => c.name).join(", ")}${silent.length > 3 ? " e outros" : ""} sem registros recentes.`,
      });
    }

    if (pctPromoters > 70 && total >= 3) {
      insights.push({ id: "promoters_high", type: "positive", title: "Promotores em alta", message: `${pctPromoters.toFixed(0)}% da carteira são promotores este mês.` });
    }

    return {
      npsScore, npsLabel: npsScoreLabel(npsScore),
      avgScore,
      pctPromoters, pctNeutrals, pctDetractors,
      respondedCount, notRespondedCount,
      biggestRise, biggestFall,
      monthlyEvolution, clientSummaries, insights, periodRecords,
    };
  }, [records, clients, year, month]);

  const createRecord = useCallback(async (data: NewNpsRecord): Promise<{ error: string | null }> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { error: "Não autenticado" };
      const { error: err } = await supabase
        .from("nps_records")
        .insert({ ...data, user_id: user.id });
      if (err) throw err;
      await fetch();
      return { error: null };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : "Erro ao criar registro" };
    }
  }, [fetch]);

  const updateRecord = useCallback(async (id: string, data: UpdateNpsRecord): Promise<{ error: string | null }> => {
    try {
      const supabase = getSupabaseClient();
      const { error: err } = await supabase
        .from("nps_records")
        .update(data)
        .eq("id", id);
      if (err) throw err;
      await fetch();
      return { error: null };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : "Erro ao atualizar" };
    }
  }, [fetch]);

  const deleteRecord = useCallback(async (id: string): Promise<{ error: string | null }> => {
    try {
      const supabase = getSupabaseClient();
      const { error: err } = await supabase
        .from("nps_records")
        .delete()
        .eq("id", id);
      if (err) throw err;
      setRecords(prev => prev.filter(r => r.id !== id));
      return { error: null };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : "Erro ao excluir" };
    }
  }, []);

  return { records, clients, isLoading, error, metrics, createRecord, updateRecord, deleteRecord, refetch: fetch };
}
