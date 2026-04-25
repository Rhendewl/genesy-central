"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle, TrendingDown, DollarSign, Users, Activity,
  CreditCard, Bell, CheckCircle2, Zap,
} from "lucide-react";
import { useFinanceiroDashboard } from "@/hooks/useFinanceiroDashboard";
import { useInadimplencia } from "@/hooks/useInadimplencia";
import { cn } from "@/lib/utils";
import type { FinancialAlert, AlertSeverity } from "@/types";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

const SEVERITY_CONFIG: Record<AlertSeverity, {
  label: string;
  containerClass: string;
  iconBg: string;
  iconColor: string;
  dot: string;
}> = {
  critical: {
    label: "Crítico",
    containerClass: "border-red-400/30 bg-red-400/[0.04]",
    iconBg: "bg-red-400/15",
    iconColor: "text-red-400",
    dot: "bg-red-400",
  },
  warning: {
    label: "Atenção",
    containerClass: "border-amber-400/25 bg-amber-400/[0.03]",
    iconBg: "bg-amber-400/15",
    iconColor: "text-amber-400",
    dot: "bg-amber-400",
  },
  info: {
    label: "Informação",
    containerClass: "border-white/10 bg-white/[0.02]",
    iconBg: "bg-[#4a8fd4]/15",
    iconColor: "text-[#4a8fd4]",
    dot: "bg-[#4a8fd4]",
  },
};

const ALERT_ICONS: Record<string, React.ReactNode> = {
  margem_baixa: <TrendingDown size={18} />,
  cliente_prejuizo: <DollarSign size={18} />,
  despesa_alta: <Zap size={18} />,
  caixa_baixo: <CreditCard size={18} />,
  receita_caindo: <Activity size={18} />,
  churn_alto: <Users size={18} />,
  cobranca_vencida: <AlertTriangle size={18} />,
  custo_alto: <TrendingDown size={18} />,
};

interface AlertCardProps {
  alert: FinancialAlert;
  delay?: number;
}

function AlertCard({ alert, delay = 0 }: AlertCardProps) {
  const sc = SEVERITY_CONFIG[alert.severity];
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className={cn("rounded-2xl border p-5 flex items-start gap-4", sc.containerClass)}
    >
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", sc.iconBg)}>
        <span className={sc.iconColor}>{ALERT_ICONS[alert.type] ?? <Bell size={18} />}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-white font-semibold text-sm">{alert.title}</p>
          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
            alert.severity === "critical" ? "text-red-400 bg-red-400/10" :
            alert.severity === "warning" ? "text-amber-400 bg-amber-400/10" :
            "text-[#4a8fd4] bg-[#4a8fd4]/10")}>
            {sc.label}
          </span>
        </div>
        <p className="text-[#c7e5ff] text-xs leading-relaxed">{alert.message}</p>
        {alert.client_name && (
          <p className="text-[#b4b4b4] text-xs mt-1.5">Cliente: {alert.client_name}</p>
        )}
        {alert.value !== undefined && (
          <p className="text-xs font-semibold mt-1.5"
            style={{ color: alert.severity === "critical" ? "#ef4444" : alert.severity === "warning" ? "#f59e0b" : "#4a8fd4" }}>
            {fmt(alert.value)}
          </p>
        )}
      </div>
    </motion.div>
  );
}

interface Props {
  year: number;
  month: number;
}

export function AlertasFinanceiros({ year, month }: Props) {
  const { data, clientProfitability } = useFinanceiroDashboard(year, month);
  const { collections, totalInadimplencia } = useInadimplencia();

  const alerts = useMemo<FinancialAlert[]>(() => {
    if (!data) return [];
    const list: FinancialAlert[] = [];
    let idx = 0;

    // Caixa baixo (< 30% do faturamento)
    if (data.caixa_disponivel < data.faturamento * 0.3 && data.faturamento > 0) {
      list.push({
        id: `a${idx++}`, type: "caixa_baixo",
        severity: data.caixa_disponivel < data.faturamento * 0.1 ? "critical" : "warning",
        title: "Caixa Disponível Baixo",
        message: `O caixa representa ${((data.caixa_disponivel / data.faturamento) * 100).toFixed(1)}% do faturamento. Considere revisar as despesas ou antecipar recebimentos.`,
        value: data.caixa_disponivel,
      });
    }

    // Receita caindo
    if (data.receita_perdida > data.receita_nova && data.receita_perdida > 0) {
      list.push({
        id: `a${idx++}`, type: "receita_caindo",
        severity: "warning",
        title: "Receita em Queda",
        message: `Perda de ${fmt(data.receita_perdida)} este mês superou os ganhos de ${fmt(data.receita_nova)}. Avalie a retenção de clientes.`,
        value: data.receita_perdida,
      });
    }

    // Margem baixa (< 20%)
    if (data.margem_geral < 20 && data.margem_geral >= 0) {
      list.push({
        id: `a${idx++}`, type: "margem_baixa",
        severity: data.margem_geral < 10 ? "critical" : "warning",
        title: "Margem Operacional Baixa",
        message: `A margem da operação está em ${data.margem_geral.toFixed(1)}%. O ideal é manter acima de 30% para uma operação saudável.`,
        value: data.margem_geral,
      });
    }

    // Margem negativa
    if (data.margem_geral < 0) {
      list.push({
        id: `a${idx++}`, type: "margem_baixa",
        severity: "critical",
        title: "Operação no Prejuízo",
        message: `As despesas superam o faturamento. Margem atual: ${data.margem_geral.toFixed(1)}%. Ação imediata necessária.`,
        value: data.lucro_liquido,
      });
    }

    // Inadimplência alta (> 15% do MRR)
    if (totalInadimplencia > data.mrr * 0.15 && data.mrr > 0) {
      list.push({
        id: `a${idx++}`, type: "cobranca_vencida",
        severity: totalInadimplencia > data.mrr * 0.3 ? "critical" : "warning",
        title: "Inadimplência Elevada",
        message: `${fmt(totalInadimplencia)} em cobrança (${((totalInadimplencia / data.mrr) * 100).toFixed(1)}% do MRR). ${collections.filter(c => c.severity === "critical").length} cliente(s) em situação crítica.`,
        value: totalInadimplencia,
      });
    }

    // Clientes no prejuízo
    const clientesPrejuizo = clientProfitability.filter(c => c.lucro < 0);
    clientesPrejuizo.forEach(cp => {
      list.push({
        id: `a${idx++}`, type: "cliente_prejuizo",
        severity: "warning",
        title: `Cliente Gerando Prejuízo`,
        message: `${cp.client.name} está gerando prejuízo de ${fmt(Math.abs(cp.lucro))} este mês. Custos de ${fmt(cp.custo_total)} vs receita de ${fmt(cp.mensalidade)}.`,
        client_id: cp.client.id,
        client_name: cp.client.name,
        value: cp.lucro,
      });
    });

    // Clientes com margem muito baixa
    const clientesMargem = clientProfitability.filter(c => c.margem > 0 && c.margem < 15);
    clientesMargem.forEach(cp => {
      list.push({
        id: `a${idx++}`, type: "margem_baixa",
        severity: "info",
        title: "Margem Baixa por Cliente",
        message: `${cp.client.name} com margem de ${cp.margem.toFixed(1)}%. Considere revisar o pricing ou os custos vinculados.`,
        client_id: cp.client.id,
        client_name: cp.client.name,
        value: cp.margem,
      });
    });

    // Despesa de tráfego alta (> 40% das receitas)
    const trafegoTotal = data.total_despesas * 0.4; // estimativa
    if (trafegoTotal > data.faturamento * 0.4 && data.faturamento > 0) {
      list.push({
        id: `a${idx++}`, type: "custo_alto",
        severity: "info",
        title: "Custo Operacional Elevado",
        message: `As despesas representam ${((data.total_despesas / data.faturamento) * 100).toFixed(1)}% do faturamento. Analise oportunidades de otimização.`,
        value: data.total_despesas,
      });
    }

    // Ordenar: critical → warning → info
    return list.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    });
  }, [data, clientProfitability, totalInadimplencia, collections]);

  const critical = alerts.filter(a => a.severity === "critical");
  const warning = alerts.filter(a => a.severity === "warning");
  const info = alerts.filter(a => a.severity === "info");

  if (!data) {
    return (
      <div className="lc-card p-8 text-center text-[#b4b4b4] text-sm animate-pulse">
        Analisando dados financeiros...
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="lc-card p-16 text-center"
        style={{ border: "1px solid rgba(34,197,94,0.25)" }}
      >
        <CheckCircle2 size={48} className="text-emerald-400/60 mx-auto mb-4" />
        <p className="text-white font-bold text-lg mb-2">Tudo em Ordem</p>
        <p className="text-[#b4b4b4] text-sm max-w-xs mx-auto">
          Nenhum alerta financeiro identificado. A operação está dentro dos parâmetros saudáveis.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary header */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-[#b4b4b4]" />
          <p className="text-sm text-[#b4b4b4]">{alerts.length} alerta{alerts.length !== 1 ? "s" : ""} identificado{alerts.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {critical.length > 0 && (
            <span className="text-xs font-semibold text-red-400 bg-red-400/10 px-3 py-1 rounded-full border border-red-400/20">
              {critical.length} crítico{critical.length !== 1 ? "s" : ""}
            </span>
          )}
          {warning.length > 0 && (
            <span className="text-xs font-semibold text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20">
              {warning.length} atenção
            </span>
          )}
          {info.length > 0 && (
            <span className="text-xs font-semibold text-[#4a8fd4] bg-[#4a8fd4]/10 px-3 py-1 rounded-full border border-[#4a8fd4]/20">
              {info.length} info
            </span>
          )}
        </div>
      </div>

      {/* Alerts by severity group */}
      {critical.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <p className="text-xs text-[#b4b4b4] font-medium uppercase tracking-wider">Críticos — Ação Imediata</p>
          </div>
          {critical.map((a, i) => <AlertCard key={a.id} alert={a} delay={i * 0.05} />)}
        </div>
      )}

      {warning.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <p className="text-xs text-[#b4b4b4] font-medium uppercase tracking-wider">Atenção — Monitorar</p>
          </div>
          {warning.map((a, i) => <AlertCard key={a.id} alert={a} delay={0.2 + i * 0.05} />)}
        </div>
      )}

      {info.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#4a8fd4]" />
            <p className="text-xs text-[#b4b4b4] font-medium uppercase tracking-wider">Informações — Oportunidades</p>
          </div>
          {info.map((a, i) => <AlertCard key={a.id} alert={a} delay={0.4 + i * 0.05} />)}
        </div>
      )}
    </div>
  );
}
