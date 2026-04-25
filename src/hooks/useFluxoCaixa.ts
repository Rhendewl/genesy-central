"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { format, addDays, startOfMonth, endOfMonth } from "date-fns";
import type { CashFlowSummary } from "@/types";

interface CashFlowEntry {
  id: string;
  type: "entrada" | "saida";
  description: string;
  amount: number;
  date: string;
  status: "previsto" | "realizado";
  client_name?: string;
}

interface UseFluxoCaixaReturn {
  summary: CashFlowSummary | null;
  entries: CashFlowEntry[];
  chartData: Array<{ data: string; entradas: number; saidas: number; saldo: number }>;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFluxoCaixa(year: number, month: number): UseFluxoCaixaReturn {
  const [summary, setSummary] = useState<CashFlowSummary | null>(null);
  const [entries, setEntries] = useState<CashFlowEntry[]>([]);
  const [chartData, setChartData] = useState<Array<{ data: string; entradas: number; saidas: number; saldo: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      const supabase = getSupabaseClient();
      const start = format(startOfMonth(new Date(year, month - 1)), "yyyy-MM-dd");
      const end = format(endOfMonth(new Date(year, month - 1)), "yyyy-MM-dd");
      const end30 = format(addDays(new Date(end), 30), "yyyy-MM-dd");
      const end60 = format(addDays(new Date(end), 60), "yyyy-MM-dd");
      const end90 = format(addDays(new Date(end), 90), "yyyy-MM-dd");

      const [{ data: revenues }, { data: expenses }, { data: future30 }, { data: futureExp30 }] = await Promise.all([
        supabase.from("revenues").select("*, client:agency_clients(name)").gte("date", start).lte("date", end),
        supabase.from("expenses").select("*").gte("date", start).lte("date", end),
        supabase.from("revenues").select("amount").gte("date", end).lte("date", end30).eq("status", "pendente"),
        supabase.from("expenses").select("amount").gte("date", end).lte("date", end30),
      ]);

      const [{ data: future60 }, { data: futureExp60 }, { data: future90 }, { data: futureExp90 }] = await Promise.all([
        supabase.from("revenues").select("amount").gte("date", end).lte("date", end60).eq("status", "pendente"),
        supabase.from("expenses").select("amount").gte("date", end).lte("date", end60),
        supabase.from("revenues").select("amount").gte("date", end).lte("date", end90).eq("status", "pendente"),
        supabase.from("expenses").select("amount").gte("date", end).lte("date", end90),
      ]);

      const entradasPrevistas = (revenues ?? []).filter(r => r.status === "pendente").reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0);
      const entradasRecebidas = (revenues ?? []).filter(r => r.status === "pago").reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0);
      const saidasPrevistas = (expenses ?? []).reduce((s: number, e: { amount: number }) => s + Number(e.amount), 0);
      const saidasPagas = saidasPrevistas;
      const saldoAtual = entradasRecebidas - saidasPagas;

      const proj30In = (future30 ?? []).reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0);
      const proj30Out = (futureExp30 ?? []).reduce((s: number, e: { amount: number }) => s + Number(e.amount), 0);
      const proj60In = (future60 ?? []).reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0);
      const proj60Out = (futureExp60 ?? []).reduce((s: number, e: { amount: number }) => s + Number(e.amount), 0);
      const proj90In = (future90 ?? []).reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0);
      const proj90Out = (futureExp90 ?? []).reduce((s: number, e: { amount: number }) => s + Number(e.amount), 0);

      setSummary({
        entradas_previstas: entradasPrevistas,
        entradas_recebidas: entradasRecebidas,
        saidas_previstas: saidasPrevistas,
        saidas_pagas: saidasPagas,
        saldo_atual: saldoAtual,
        projecao_30: saldoAtual + proj30In - proj30Out,
        projecao_60: saldoAtual + proj60In - proj60Out,
        projecao_90: saldoAtual + proj90In - proj90Out,
      });

      // Entries list
      const entriesData: CashFlowEntry[] = [
        ...(revenues ?? []).map((r: { id: string; description: string; amount: number; date: string; status: string; client?: { name: string } }) => ({
          id: r.id,
          type: "entrada" as const,
          description: r.description,
          amount: Number(r.amount),
          date: r.date,
          status: r.status === "pago" ? "realizado" as const : "previsto" as const,
          client_name: r.client?.name,
        })),
        ...(expenses ?? []).map((e: { id: string; description: string; amount: number; date: string }) => ({
          id: e.id,
          type: "saida" as const,
          description: e.description,
          amount: Number(e.amount),
          date: e.date,
          status: "realizado" as const,
        })),
      ].sort((a, b) => b.date.localeCompare(a.date));

      setEntries(entriesData);

      // Chart data by day (simplified: by week)
      const chart = Array.from({ length: 4 }, (_, i) => {
        const weekStart = format(addDays(new Date(start), i * 7), "dd/MM");
        const weekRevs = (revenues ?? []).filter((r: { date: string; status: string }) => {
          const day = new Date(r.date).getDate();
          return day >= i * 7 + 1 && day <= (i + 1) * 7 && r.status === "pago";
        }).reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0);
        const weekExps = (expenses ?? []).filter((e: { date: string }) => {
          const day = new Date(e.date).getDate();
          return day >= i * 7 + 1 && day <= (i + 1) * 7;
        }).reduce((s: number, e: { amount: number }) => s + Number(e.amount), 0);
        return { data: weekStart, entradas: weekRevs, saidas: weekExps, saldo: weekRevs - weekExps };
      });

      setChartData(chart);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar fluxo de caixa");
    } finally {
      setIsLoading(false);
    }
  }, [year, month]);

  useEffect(() => { fetch(); }, [fetch]);

  return { summary, entries, chartData, isLoading, error, refetch: fetch };
}
