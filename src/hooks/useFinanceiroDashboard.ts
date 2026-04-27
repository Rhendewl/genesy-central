"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import {
  format, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, parseISO, differenceInMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { FinancialDashboardData, ClientProfitability } from "@/types";

interface UseFinanceiroDashboardReturn {
  data: FinancialDashboardData | null;
  clientProfitability: ClientProfitability[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFinanceiroDashboard(
  year: number,
  month: number,
  since?: string | null,
  until?: string | null,
): UseFinanceiroDashboardReturn {
  const [data, setData] = useState<FinancialDashboardData | null>(null);
  const [clientProfitability, setClientProfitability] = useState<ClientProfitability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const supabase = getSupabaseClient();

      // Date range: use explicit since/until when provided, else full month
      const currentStart = since ?? format(startOfMonth(new Date(year, month - 1)), "yyyy-MM-dd");
      const currentEnd   = until ?? format(endOfMonth(new Date(year, month - 1)), "yyyy-MM-dd");

      // Always fetch 6-month history anchored to the current month for secondary charts
      const historyStart = format(startOfMonth(subMonths(new Date(year, month - 1), 5)), "yyyy-MM-dd");

      const [
        { data: revenues },
        { data: expenses },
        { data: clients },
        { data: allRevenues6m },
        { data: allExpenses6m },
        { data: costShares },
      ] = await Promise.all([
        supabase.from("revenues").select("*").gte("date", currentStart).lte("date", currentEnd),
        supabase.from("expenses").select("*").gte("date", currentStart).lte("date", currentEnd),
        supabase
          .from("agency_clients")
          .select("*, expenses:expenses(amount, date), revenues:revenues(amount, status, date)"),
        supabase
          .from("revenues")
          .select("amount, date, status")
          .gte("date", historyStart)
          .lte("date", currentEnd),
        supabase
          .from("expenses")
          .select("amount, date")
          .gte("date", historyStart)
          .lte("date", currentEnd),
        supabase
          .from("client_cost_shares")
          .select("client_id, percentage"),
      ]);

      // ── KPIs ──────────────────────────────────────────────────────────────────
      const faturamento       = (revenues ?? []).filter(r => r.status === "pago").reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0);
      const totalDespesasDiretas = (expenses ?? []).reduce((s: number, e: { amount: number }) => s + Number(e.amount), 0);
      const receitaTotal      = (revenues ?? []).reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0);
      const inadimplencia     = (revenues ?? []).filter(r => r.status === "atrasado").reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0);

      const clientesAtivos  = (clients ?? []).filter(c => c.status === "ativo").length;
      const novosContratos  = (clients ?? []).filter(c =>
        c.contract_start && c.contract_start >= currentStart && c.contract_start <= currentEnd
      ).length;
      const mrr             = (clients ?? []).filter(c => c.status === "ativo").reduce((s: number, c: { monthly_fee: number }) => s + Number(c.monthly_fee), 0);
      const ticketMedio     = clientesAtivos > 0 ? mrr / clientesAtivos : 0;

      // ── Commissions (cost shares) ─────────────────────────────────────────────
      // Monthly total = sum of (monthly_fee × percentage%) for each active client's partners
      const totalComissoesMes = (clients ?? [])
        .filter(c => c.status === "ativo")
        .reduce((total: number, c: { id: string; monthly_fee: number }) => {
          const clientShares = (costShares ?? [])
            .filter((s: { client_id: string }) => s.client_id === c.id);
          const clientComm = clientShares.reduce(
            (sum: number, s: { percentage: number }) => sum + (Number(c.monthly_fee) * Number(s.percentage) / 100),
            0
          );
          return total + clientComm;
        }, 0);

      // ── Daily arrays (declare early — reused in commission scaling) ────────────
      const days = eachDayOfInterval({ start: parseISO(currentStart), end: parseISO(currentEnd) });

      // Scale commissions to period length (proportional to 30-day month)
      const totalComissoesPeriodo = totalComissoesMes * (days.length / 30);
      const comissaoPorDia        = totalComissoesMes / 30;

      const totalDespesas = totalDespesasDiretas + totalComissoesPeriodo;
      const lucroBruto    = receitaTotal - totalDespesas;
      const lucroLiquido  = faturamento - totalDespesas;
      const margemGeral   = faturamento > 0 ? ((faturamento - totalDespesas) / faturamento) * 100 : 0;

      // receita_nova / receita_perdida based on 6m history (prev calendar month vs current)
      const prevMonthStart = format(startOfMonth(subMonths(new Date(year, month - 1), 1)), "yyyy-MM-dd");
      const prevMonthEnd   = format(endOfMonth(subMonths(new Date(year, month - 1), 1)), "yyyy-MM-dd");
      const prevFaturamento = (allRevenues6m ?? [])
        .filter((r: { date: string; status: string }) => r.date >= prevMonthStart && r.date <= prevMonthEnd && r.status === "pago")
        .reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0);
      const receitaNova    = Math.max(0, faturamento - prevFaturamento);
      const receitaPerdida = Math.max(0, prevFaturamento - faturamento);

      const receita_diaria = days.map(d => {
        const key = format(d, "yyyy-MM-dd");
        const val = (revenues ?? [])
          .filter((r: { date: string; status: string }) => r.date === key && r.status === "pago")
          .reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0);
        return { data: format(d, "dd/MM", { locale: ptBR }), valor: val };
      });

      // commissions spread evenly per day
      const comissao_diaria = days.map(d => ({
        data: format(d, "dd/MM", { locale: ptBR }),
        valor: comissaoPorDia,
      }));

      // direct expenses + daily commission slice
      const despesa_diaria = days.map((d, i) => {
        const key = format(d, "yyyy-MM-dd");
        const direct = (expenses ?? [])
          .filter((e: { date: string }) => e.date === key)
          .reduce((s: number, e: { amount: number }) => s + Number(e.amount), 0);
        return { data: format(d, "dd/MM", { locale: ptBR }), valor: direct + (comissao_diaria[i]?.valor ?? 0) };
      });

      const lucro_diario = receita_diaria.map((r, i) => ({
        data: r.data,
        valor: r.valor - (despesa_diaria[i]?.valor ?? 0),
      }));

      // ── Monthly chart data (last 6 months) ────────────────────────────────────
      const meses6 = Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(new Date(year, month - 1), 5 - i);
        return { key: format(d, "yyyy-MM"), label: format(d, "MMM/yy") };
      });

      const receitaVsDespesa = meses6.map(({ key, label }) => {
        const rec       = (allRevenues6m ?? []).filter((r: { date: string; status: string }) => r.date.startsWith(key) && r.status === "pago").reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0);
        const despDirect = (allExpenses6m ?? []).filter((e: { date: string }) => e.date.startsWith(key)).reduce((s: number, e: { amount: number }) => s + Number(e.amount), 0);
        const comissao  = totalComissoesMes;
        return { mes: label, receita: rec, despesa: despDirect + comissao, comissao };
      });

      const evolucaoLucro  = receitaVsDespesa.map(({ mes, receita, despesa }) => ({ mes, lucro: receita - despesa }));
      const crescimentoMrr = meses6.map(({ label }) => ({ mes: label, mrr }));
      const fluxoMensal    = receitaVsDespesa.map(({ mes, receita, despesa }) => ({
        mes, entradas: receita, saidas: despesa, saldo: receita - despesa,
      }));

      // ── Client profitability ──────────────────────────────────────────────────
      const today = new Date();
      const profitability: ClientProfitability[] = (clients ?? [])
        .filter(c => c.status === "ativo")
        .map(c => {
          const mensalidade = Number(c.monthly_fee);

          // Direct expenses linked to this client in the period
          const custosExpenses = (c.expenses ?? [])
            .filter((e: { date: string }) => e.date >= currentStart && e.date <= currentEnd)
            .reduce((s: number, e: { amount: number }) => s + Number(e.amount), 0);

          // Partner/commission costs based on monthly_fee percentage
          const custosParceiros = (costShares ?? [])
            .filter((s: { client_id: string }) => s.client_id === c.id)
            .reduce((sum: number, s: { percentage: number }) => sum + (mensalidade * Number(s.percentage) / 100), 0);

          const custoTotal = custosExpenses + custosParceiros;

          // Lucro and margem use monthly_fee as revenue base (not revenues table entries,
          // which may be absent even when the client is active and paying their monthly fee).
          const lucro  = mensalidade - custoTotal;
          const margem = mensalidade > 0 ? (lucro / mensalidade) * 100 : 0;

          // Contract duration: active clients use today; encerrados use contract_end.
          const contractStart = c.contract_start ? parseISO(c.contract_start) : parseISO(c.created_at);
          const endRef = c.contract_end ? parseISO(c.contract_end) : today;
          const tempoMeses = Math.max(0, differenceInMonths(endRef, contractStart));

          return {
            client: c,
            mensalidade,
            custo_total: custoTotal,
            custo_midia: 0,
            outros_custos: custosExpenses,
            custo_parceiros: custosParceiros,
            lucro,
            margem,
            tempo_contrato_meses: tempoMeses,
          };
        })
        .sort((a, b) => b.mensalidade - a.mensalidade);

      setData({
        faturamento, mrr,
        receita_nova: receitaNova, receita_perdida: receitaPerdida,
        lucro_bruto: lucroBruto, lucro_liquido: lucroLiquido,
        caixa_disponivel: lucroLiquido,
        clientes_ativos: clientesAtivos, novos_contratos: novosContratos,
        ticket_medio: ticketMedio, total_despesas: totalDespesas,
        total_comissoes: totalComissoesPeriodo,
        inadimplencia, margem_geral: margemGeral,
        receita_vs_despesa: receitaVsDespesa,
        evolucao_lucro: evolucaoLucro,
        crescimento_mrr: crescimentoMrr,
        fluxo_mensal: fluxoMensal,
        receita_diaria, despesa_diaria, comissao_diaria, lucro_diario,
      });

      setClientProfitability(profitability);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar dashboard");
    } finally {
      setIsLoading(false);
    }
  }, [year, month, since, until]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, clientProfitability, isLoading, error, refetch: fetch };
}
