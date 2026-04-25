"use client";

import { useMemo, useState } from "react";
import {
  ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign, TrendingDown, TrendingUp, Users,
  Wallet, AlertCircle, Activity, CreditCard,
  ChevronDown, ArrowRight, Target, Zap,
  BarChart2, Clock, ShieldCheck,
} from "lucide-react";
import { subDays, format } from "date-fns";
import { useFinanceiroDashboard } from "@/hooks/useFinanceiroDashboard";
import { useMetas } from "@/hooks/useMetas";
import { cn } from "@/lib/utils";

// ── Formatters ─────────────────────────────────────────────────────────────────

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const fmtNum = (v: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const fmtPctSigned = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

// ── Period config ──────────────────────────────────────────────────────────────

type PeriodKey = "7d" | "30d" | "3m" | "6m" | "12m";
type MetricType = "volume" | "cost";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "7d",  label: "7 dias"  },
  { key: "30d", label: "30 dias" },
  { key: "3m",  label: "3 meses" },
  { key: "6m",  label: "6 meses" },
  { key: "12m", label: "12 meses" },
];

function getPeriodDates(period: PeriodKey): { since: string; until: string } {
  const today = new Date();
  const until = format(today, "yyyy-MM-dd");
  const days = period === "7d" ? 6 : period === "30d" ? 29 : period === "3m" ? 89 : period === "6m" ? 179 : 364;
  return { since: format(subDays(today, days), "yyyy-MM-dd"), until };
}

function getPrevPeriodDates(period: PeriodKey): { since: string; until: string } {
  const today = new Date();
  const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "3m" ? 90 : period === "6m" ? 180 : 365;
  const until = format(subDays(today, days), "yyyy-MM-dd");
  const since = format(subDays(today, days * 2 - 1), "yyyy-MM-dd");
  return { since, until };
}

function periodChange(current: number, previous: number): number | null {
  if (previous === 0 || current === 0) return null;
  return ((current - previous) / previous) * 100;
}

// ── Trend Badge ────────────────────────────────────────────────────────────────

function TrendBadge({ change, metricType = "volume" }: { change: number | null; metricType?: MetricType }) {
  if (change === null) return null;
  if (Math.abs(change) < 0.5) {
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
        style={{ color: "#b4b4b4", background: "rgba(180,180,180,0.10)" }}
        title="Comparado ao período anterior">
        estável
      </span>
    );
  }
  const isImprovement = metricType === "cost" ? change < 0 : change > 0;
  const color = isImprovement ? "#10b981" : "#ef4444";
  const bg    = isImprovement ? "rgba(16,185,129,0.10)" : "rgba(239,68,68,0.10)";
  const label = metricType === "cost"
    ? (isImprovement ? "eficiência" : "custo +")
    : (isImprovement ? "cresceu"    : "caiu");
  const tooltip = metricType === "cost"
    ? `Comparado ao período anterior — ${isImprovement ? "redução = melhora" : "aumento = piora"}`
    : "Comparado ao período anterior";
  return (
    <span className="flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full cursor-default"
      style={{ color, background: bg }} title={tooltip}>
      {change < 0 ? <TrendingDown size={9} /> : <TrendingUp size={9} />}
      {Math.abs(change).toFixed(1)}%
      <span className="opacity-70 ml-0.5 hidden sm:inline">· {label}</span>
    </span>
  );
}

// ── Period Selector ────────────────────────────────────────────────────────────

function PeriodSelector({ value, onChange, size = "sm" }: {
  value: PeriodKey;
  onChange: (p: PeriodKey) => void;
  size?: "sm" | "xs";
}) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-lg"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
      {PERIODS.map(p => (
        <button key={p.key} onClick={() => onChange(p.key)}
          className={cn(
            "rounded-md font-medium transition-all",
            size === "xs" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
            value === p.key ? "text-white" : "text-[#b4b4b4] hover:text-white"
          )}
          style={value === p.key ? { background: "rgba(74,143,212,0.20)", color: "#4a8fd4" } : {}}>
          {p.label}
        </button>
      ))}
    </div>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ data, dataKey, color }: { data: Record<string, unknown>[]; dataKey: string; color: string }) {
  if (!data?.length) return null;
  return (
    <ResponsiveContainer width="100%" height={38}>
      <ComposedChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5}
          dot={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ── KPI Card Premium ───────────────────────────────────────────────────────────

interface KpiPremiumProps {
  title: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent: string;
  change?: number | null;
  metricType?: MetricType;
  sparklineData?: Record<string, unknown>[];
  sparklineKey?: string;
  delay?: number;
}

function KpiCardPremium({ title, value, sub, icon, accent, change, metricType = "volume", sparklineData, sparklineKey, delay = 0 }: KpiPremiumProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="lc-card p-5 flex flex-col gap-1 relative overflow-hidden group"
      style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)" }}
    >
      <div className="absolute -top-6 -left-6 w-20 h-20 rounded-full blur-2xl pointer-events-none"
        style={{ background: `${accent}18` }} />
      <div className="flex items-start justify-between mb-2 relative">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${accent}18`, border: `1px solid ${accent}25` }}>
            <div style={{ color: accent }}>{icon}</div>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "#7a7a8a" }}>{title}</p>
        </div>
        <TrendBadge change={change ?? null} metricType={metricType} />
      </div>
      <p className="text-[28px] font-bold text-white leading-none tracking-tight">{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: "#7a7a8a" }}>{sub}</p>}
      {sparklineData && sparklineKey && (
        <div className="mt-3 -mx-1">
          <Sparkline data={sparklineData} dataKey={sparklineKey} color={accent} />
        </div>
      )}
    </motion.div>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────────

const FinTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-4 py-3 text-sm shadow-2xl"
      style={{ background: "rgba(10,12,22,0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <p className="text-[#7a7a8a] text-[11px] mb-2 font-medium">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 mb-1 last:mb-0">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-[#c7e5ff] text-xs">{p.name}:</span>
          <span className="text-white font-semibold text-xs">{fmtBRL(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ── Hero Chart ─────────────────────────────────────────────────────────────────

function HeroChart({ data, period, onPeriodChange }: {
  data: { label: string; receita: number; despesa: number; lucro: number }[];
  period: PeriodKey;
  onPeriodChange: (p: PeriodKey) => void;
}) {
  const isEmpty = !data.length || data.every(d => d.receita === 0 && d.despesa === 0);
  const interval = data.length > 60 ? Math.floor(data.length / 8) - 1 : data.length > 30 ? 6 : "preserveStartEnd";

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
      className="lc-card p-6">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">Fluxo Financeiro no Tempo</h3>
          <p className="text-[11px] mt-0.5" style={{ color: "#7a7a8a" }}>Receita, despesas e lucro líquido</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            {[{ color: "#10b981", label: "Receita" }, { color: "#f59e0b", label: "Despesas" }, { color: "#4a8fd4", label: "Lucro" }].map(s => (
              <div key={s.label} className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 rounded-full" style={{ background: s.color }} />
                <span className="text-[11px]" style={{ color: "#7a7a8a" }}>{s.label}</span>
              </div>
            ))}
          </div>
          <PeriodSelector value={period} onChange={onPeriodChange} size="xs" />
        </div>
      </div>
      {isEmpty ? (
        <div className="h-[200px] flex flex-col items-center justify-center gap-2">
          <BarChart2 size={28} style={{ color: "#3a3a4a" }} />
          <p className="text-sm" style={{ color: "#5a5a6a" }}>Sem dados no período</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#5a5a6a", fontSize: 10 }} axisLine={false} tickLine={false}
              interval={interval} />
            <YAxis tick={{ fill: "#5a5a6a", fontSize: 10 }} axisLine={false} tickLine={false} width={52}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
            <Tooltip content={<FinTooltip />} />
            <Line type="monotone" dataKey="receita" name="Receita" stroke="#10b981" strokeWidth={2}
              dot={false} activeDot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: "#0e151b" }} />
            <Line type="monotone" dataKey="despesa" name="Despesas" stroke="#f59e0b" strokeWidth={2}
              dot={false} activeDot={{ r: 4, fill: "#f59e0b", strokeWidth: 2, stroke: "#0e151b" }} />
            <Line type="monotone" dataKey="lucro" name="Lucro" stroke="#4a8fd4" strokeWidth={2}
              dot={false} activeDot={{ r: 4, fill: "#4a8fd4", strokeWidth: 2, stroke: "#0e151b" }} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
}

// ── Saúde Financeira ───────────────────────────────────────────────────────────

function SaudeFinanceira({ data }: {
  data: { margem_geral: number; inadimplencia: number; ticket_medio: number; clientes_ativos: number };
}) {
  const margemColor = data.margem_geral >= 30 ? "#10b981" : data.margem_geral >= 0 ? "#f59e0b" : "#ef4444";
  const items = [
    { label: "Margem",         value: fmtPct(data.margem_geral),      color: margemColor,   icon: <Activity size={13} />,   sub: data.margem_geral >= 30 ? "saudável" : data.margem_geral >= 0 ? "atenção" : "crítica" },
    { label: "Inadimplência",  value: fmtBRL(data.inadimplencia),     color: data.inadimplencia > 0 ? "#ef4444" : "#10b981", icon: <AlertCircle size={13} />, sub: data.inadimplencia > 0 ? "em atraso" : "em dia" },
    { label: "Ticket Médio",   value: fmtBRL(data.ticket_medio),      color: "#4a8fd4",     icon: <CreditCard size={13} />, sub: "por cliente ativo" },
    { label: "Clientes Ativos",value: fmtNum(data.clientes_ativos),   color: "#10b981",     icon: <Users size={13} />,      sub: "em contrato" },
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
      className="lc-card p-6 flex flex-col">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-white">Saúde Financeira</h3>
        <p className="text-[11px] mt-0.5" style={{ color: "#7a7a8a" }}>Indicadores operacionais</p>
      </div>
      <div className="grid grid-cols-2 gap-3 flex-1">
        {items.map((item, i) => (
          <motion.div key={item.label}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 + i * 0.05 }}
            className="rounded-xl p-3.5"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-1.5 mb-1.5" style={{ color: item.color }}>
              {item.icon}
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#6a6a7a" }}>{item.label}</p>
            </div>
            <p className="text-[18px] font-bold text-white leading-tight">{item.value}</p>
            <p className="text-[10px] mt-0.5" style={{ color: item.color }}>{item.sub}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Projeção Financeira ────────────────────────────────────────────────────────

function ProjecaoFinanceira({ data, goal, receitaChange }: {
  data: { mrr: number; total_despesas: number; caixa_disponivel: number; faturamento: number };
  goal: { revenue_goal: number; margin_goal: number } | null;
  receitaChange: number | null;
}) {
  const projecao30 = data.mrr - (data.total_despesas || 0);
  const runway = data.total_despesas > 0
    ? Math.max(0, data.caixa_disponivel / data.total_despesas)
    : null;
  const metaPct = goal && goal.revenue_goal > 0
    ? Math.min(100, (data.faturamento / goal.revenue_goal) * 100)
    : null;

  const trendPositive = receitaChange !== null && receitaChange > 0;
  const trendText = receitaChange !== null
    ? `${receitaChange >= 0 ? "+" : ""}${receitaChange.toFixed(1)}% vs período anterior`
    : "Sem dados suficientes";

  const rows = [
    {
      icon: <Wallet size={13} />,
      label: "Projeção de Caixa (30d)",
      value: fmtBRL(projecao30),
      sub: "MRR − despesas médias",
      color: projecao30 >= 0 ? "#10b981" : "#ef4444",
    },
    {
      icon: <TrendingUp size={13} />,
      label: "Tendência de Crescimento",
      value: receitaChange !== null ? fmtPctSigned(receitaChange) : "—",
      sub: trendText,
      color: trendPositive ? "#10b981" : receitaChange !== null ? "#ef4444" : "#6a6a7a",
    },
    {
      icon: <Target size={13} />,
      label: "Meta do Mês",
      value: metaPct !== null ? `${metaPct.toFixed(0)}%` : "—",
      sub: goal ? `de ${fmtBRL(goal.revenue_goal)} atingido` : "Meta não definida",
      color: metaPct !== null ? (metaPct >= 80 ? "#10b981" : metaPct >= 50 ? "#f59e0b" : "#ef4444") : "#6a6a7a",
    },
    {
      icon: <Clock size={13} />,
      label: "Runway Estimado",
      value: runway !== null ? (runway > 24 ? "24m+" : `${runway.toFixed(1)}m`) : "—",
      sub: runway !== null ? "meses com saldo atual" : "calcular com despesas",
      color: runway !== null ? (runway >= 6 ? "#10b981" : runway >= 3 ? "#f59e0b" : "#ef4444") : "#6a6a7a",
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
      className="lc-card p-6 flex flex-col">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-white">Projeção Financeira</h3>
        <p className="text-[11px] mt-0.5" style={{ color: "#7a7a8a" }}>Tendências e previsões</p>
      </div>
      <div className="flex flex-col gap-3 flex-1">
        {rows.map((row, i) => (
          <motion.div key={row.label}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.45 + i * 0.05 }}
            className="flex items-center justify-between gap-3 py-3 px-3 rounded-xl"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${row.color}18`, color: row.color }}>
                {row.icon}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-white leading-tight">{row.label}</p>
                <p className="text-[10px] truncate" style={{ color: "#6a6a7a" }}>{row.sub}</p>
              </div>
            </div>
            <span className="text-[15px] font-bold shrink-0" style={{ color: row.color }}>{row.value}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Top Clientes ───────────────────────────────────────────────────────────────

function TopClientes({ clientes, totalFaturamento, onVerTodos }: {
  clientes: { nome: string; receita: number; margem: number; status: string }[];
  totalFaturamento: number;
  onVerTodos?: () => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
      className="lc-card p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-white">Receita por Cliente</h3>
          <p className="text-[11px] mt-0.5" style={{ color: "#7a7a8a" }}>Top clientes por faturamento</p>
        </div>
        {onVerTodos && (
          <button onClick={onVerTodos}
            className="flex items-center gap-1 text-[11px] font-medium transition-colors hover:text-white"
            style={{ color: "#4a8fd4" }}>
            Ver todos <ArrowRight size={10} />
          </button>
        )}
      </div>
      {clientes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <Users size={28} style={{ color: "#3a3a4a" }} />
          <p className="text-sm" style={{ color: "#5a5a6a" }}>Sem clientes ativos no período</p>
        </div>
      ) : (
        <div className="flex flex-col gap-px">
          <div className="grid gap-2 px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "#5a5a6a", gridTemplateColumns: "1fr 88px 60px 56px" }}>
            <span>Cliente</span>
            <span className="text-right">Receita</span>
            <span className="text-right">Part. %</span>
            <span className="text-right">Margem</span>
          </div>
          {clientes.map((c, i) => {
            const participacao = totalFaturamento > 0 ? (c.receita / totalFaturamento) * 100 : 0;
            const margemColor  = c.margem >= 30 ? "#10b981" : c.margem >= 0 ? "#f59e0b" : "#ef4444";
            return (
              <motion.div key={c.nome}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.04 }}
                className="grid gap-2 px-2 py-2.5 rounded-xl items-center hover:bg-white/[0.03] transition-colors"
                style={{ gridTemplateColumns: "1fr 88px 60px 56px" }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-bold w-4 text-center shrink-0"
                    style={{ color: i === 0 ? "#f59e0b" : "#5a5a6a" }}>{i + 1}</span>
                  <span className="text-[12px] text-white font-medium truncate" title={c.nome}>{c.nome}</span>
                </div>
                <span className="text-[12px] font-medium text-right" style={{ color: "#c7e5ff" }}>{fmtBRL(c.receita)}</span>
                <span className="text-[12px] font-medium text-right" style={{ color: "#7a7a8a" }}>{fmtPct(participacao)}</span>
                <span className="text-[12px] font-semibold text-right" style={{ color: margemColor }}>{fmtPct(c.margem)}</span>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ── Insights Financeiros ───────────────────────────────────────────────────────

type InsightType = "success" | "info" | "warning" | "danger";
interface Insight { type: InsightType; icon: React.ReactNode; title: string; desc: string }

const INSIGHT_STYLES: Record<InsightType, { color: string; bg: string; border: string }> = {
  success: { color: "#10b981", bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.18)" },
  info:    { color: "#4a8fd4", bg: "rgba(74,143,212,0.08)",  border: "rgba(74,143,212,0.18)" },
  warning: { color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.18)" },
  danger:  { color: "#ef4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.18)" },
};

function InsightsFinanceiros({ data, receitaChange, despesaChange, topCliente }: {
  data: { faturamento: number; total_despesas: number; inadimplencia: number; margem_geral: number; mrr: number };
  receitaChange: number | null;
  despesaChange: number | null;
  topCliente: { nome: string; receita: number } | null;
}) {
  const insights = useMemo<Insight[]>(() => {
    const list: Insight[] = [];

    if (receitaChange !== null) {
      list.push(receitaChange >= 0 ? {
        type: "success", icon: <TrendingUp size={13} />,
        title: "Receita cresceu",
        desc: `+${receitaChange.toFixed(1)}% vs período anterior`,
      } : {
        type: "warning", icon: <TrendingDown size={13} />,
        title: "Queda de receita detectada",
        desc: `${receitaChange.toFixed(1)}% vs período anterior`,
      });
    }

    if (despesaChange !== null && despesaChange > 15) {
      list.push({
        type: "warning", icon: <AlertCircle size={13} />,
        title: "Despesas subiram",
        desc: `+${despesaChange.toFixed(1)}% vs período anterior — monitorar`,
      });
    }

    if (data.margem_geral >= 30) {
      list.push({ type: "success", icon: <ShieldCheck size={13} />, title: "Margem saudável", desc: `${fmtPct(data.margem_geral)} de margem — acima da meta de 30%` });
    } else if (data.margem_geral < 0) {
      list.push({ type: "danger",  icon: <AlertCircle size={13} />, title: "Margem negativa", desc: `${fmtPct(data.margem_geral)} — operação no prejuízo` });
    } else {
      list.push({ type: "warning", icon: <Activity size={13} />, title: "Margem abaixo do ideal", desc: `${fmtPct(data.margem_geral)} — meta é acima de 30%` });
    }

    if (topCliente && data.faturamento > 0) {
      const pct = (topCliente.receita / data.faturamento) * 100;
      const type: InsightType = pct > 50 ? "warning" : "info";
      list.push({ type, icon: <Users size={13} />, title: `${topCliente.nome} é o maior cliente`, desc: `Representa ${pct.toFixed(0)}% do faturamento${pct > 50 ? " — alta concentração" : ""}` });
    }

    if (data.inadimplencia > 0) {
      list.push({ type: "danger", icon: <AlertCircle size={13} />, title: "Inadimplência ativa", desc: `${fmtBRL(data.inadimplencia)} em receitas atrasadas` });
    }

    return list;
  }, [data, receitaChange, despesaChange, topCliente]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
      className="lc-card p-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(74,143,212,0.15)" }}>
          <Zap size={13} style={{ color: "#4a8fd4" }} />
        </div>
        <div>
          <h3 className="text-base font-semibold text-white leading-none">Insights Financeiros</h3>
          <p className="text-[11px] mt-0.5" style={{ color: "#7a7a8a" }}>Análise automática do período</p>
        </div>
      </div>
      {insights.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <Activity size={24} style={{ color: "#3a3a4a" }} />
          <p className="text-sm" style={{ color: "#5a5a6a" }}>Sem dados suficientes para insights</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {insights.map((ins, i) => {
            const s = INSIGHT_STYLES[ins.type];
            return (
              <motion.div key={i} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.55 + i * 0.05 }}
                className="rounded-xl p-3.5 flex items-start gap-3"
                style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: `${s.color}20`, color: s.color }}>{ins.icon}</div>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-white leading-tight">{ins.title}</p>
                  <p className="text-[11px] mt-0.5 leading-snug" style={{ color: "#9a9aaa" }}>{ins.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ── Métricas Detalhadas (collapsible) ──────────────────────────────────────────

function MetricasDetalhadas({ data }: {
  data: {
    lucro_bruto: number; receita_nova: number; receita_perdida: number;
    novos_contratos: number; clientes_ativos: number; mrr: number;
  };
}) {
  const [open, setOpen] = useState(false);
  const items = [
    { label: "Lucro Bruto",       value: fmtBRL(data.lucro_bruto),           icon: <TrendingUp size={12} />, color: "#10b981" },
    { label: "Receita Nova",       value: fmtBRL(data.receita_nova),          icon: <ArrowRight size={12} />, color: "#22c55e" },
    { label: "Receita Perdida",    value: fmtBRL(data.receita_perdida),       icon: <TrendingDown size={12} />, color: "#f59e0b" },
    { label: "Novos Contratos",    value: fmtNum(data.novos_contratos),       icon: <DollarSign size={12} />,  color: "#4a8fd4" },
    { label: "Clientes Ativos",    value: fmtNum(data.clientes_ativos),       icon: <Users size={12} />,       color: "#b4b4b4" },
    { label: "MRR",                value: fmtBRL(data.mrr),                   icon: <Activity size={12} />,   color: "#4a8fd4" },
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
      className="lc-card overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-5 text-left transition-colors hover:bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">Métricas Detalhadas</span>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{ color: "#4a8fd4", background: "rgba(74,143,212,0.12)" }}>
            {items.length} indicadores
          </span>
        </div>
        <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} style={{ color: "#5a5a6a" }} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} style={{ overflow: "hidden" }}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-5 pt-0">
              {items.map(item => (
                <div key={item.label} className="rounded-xl p-3.5"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center gap-1.5 mb-1.5" style={{ color: item.color }}>
                    {item.icon}
                    <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "#6a6a7a" }}>{item.label}</p>
                  </div>
                  <p className="text-lg font-bold text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="lc-card p-5 h-36 animate-pulse">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-xl bg-white/5" />
              <div className="h-2 bg-white/5 rounded w-20" />
            </div>
            <div className="h-8 bg-white/5 rounded w-28 mb-2" />
            <div className="h-2 bg-white/5 rounded w-16 mb-3" />
            <div className="h-8 bg-white/[0.03] rounded" />
          </div>
        ))}
      </div>
      <div className="lc-card h-72 animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="lc-card h-52 animate-pulse" />
        <div className="lc-card h-52 animate-pulse" />
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface Props {
  year: number;
  month: number;
  onNavigateToTab?: (tab: string) => void;
}

export function DashboardFinanceiro({ year, month, onNavigateToTab }: Props) {
  const [period, setPeriod]       = useState<PeriodKey>("30d");
  const [heroPeriod, setHeroPeriod] = useState<PeriodKey>("30d");

  const { since, until }               = useMemo(() => getPeriodDates(period), [period]);
  const { since: prevSince, until: prevUntil } = useMemo(() => getPrevPeriodDates(period), [period]);
  const { since: heroSince, until: heroUntil } = useMemo(() => getPeriodDates(heroPeriod), [heroPeriod]);

  const { data, clientProfitability, isLoading } = useFinanceiroDashboard(year, month, since, until);
  const { data: prevData }                        = useFinanceiroDashboard(year, month, prevSince, prevUntil);
  const { data: heroRaw }                         = useFinanceiroDashboard(year, month, heroSince, heroUntil);
  const { goal }                                  = useMetas(year, month);

  // % changes current vs previous period
  const changes = useMemo(() => {
    if (!data || !prevData) return { receita: null, despesa: null, lucro: null, caixa: null };
    return {
      receita: periodChange(data.faturamento,     prevData.faturamento),
      despesa: periodChange(data.total_despesas,  prevData.total_despesas),
      lucro:   periodChange(data.lucro_liquido,   prevData.lucro_liquido),
      caixa:   periodChange(data.caixa_disponivel,prevData.caixa_disponivel),
    };
  }, [data, prevData]);

  // Hero chart data — use daily for short periods, monthly for long
  const heroData = useMemo(() => {
    if (!heroRaw) return [];
    if (["7d", "30d"].includes(heroPeriod)) {
      return heroRaw.receita_diaria.map((r, i) => ({
        label: r.data,
        receita: r.valor,
        despesa: heroRaw.despesa_diaria[i]?.valor ?? 0,
        lucro:   heroRaw.lucro_diario[i]?.valor ?? 0,
      }));
    }
    return heroRaw.receita_vs_despesa.map(d => ({
      label:   d.mes,
      receita: d.receita,
      despesa: d.despesa,
      lucro:   d.receita - d.despesa,
    }));
  }, [heroRaw, heroPeriod]);

  // Top clientes (sorted by mensalidade desc)
  const topClientes = useMemo(() =>
    clientProfitability.slice(0, 5).map(c => ({
      nome:    c.client.name,
      receita: c.mensalidade,
      margem:  c.margem,
      status:  c.client.status,
    })),
    [clientProfitability]
  );

  const topCliente = topClientes[0] ?? null;
  const totalFaturamento = topClientes.reduce((s, c) => s + c.receita, 0);

  if (isLoading || !data) return <DashboardSkeleton />;

  return (
    <div className="space-y-5">
      {/* Period filter */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-[12px]" style={{ color: "#5a5a6a" }}>Período de análise</p>
        <PeriodSelector value={period} onChange={p => { setPeriod(p); setHeroPeriod(p); }} />
      </div>

      {/* ── Row 1: 5 KPI cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCardPremium
          title="Receita" value={fmtBRL(data.faturamento)} sub="Receitas pagas"
          icon={<DollarSign size={16} />} accent="#10b981"
          change={changes.receita}
          sparklineData={data.receita_diaria as unknown as Record<string, unknown>[]}
          sparklineKey="valor" delay={0}
        />
        <KpiCardPremium
          title="Despesas" value={fmtBRL(data.total_despesas)} sub="Saídas no período"
          icon={<TrendingDown size={16} />} accent="#f59e0b"
          change={changes.despesa} metricType="cost"
          sparklineData={data.despesa_diaria as unknown as Record<string, unknown>[]}
          sparklineKey="valor" delay={0.06}
        />
        <KpiCardPremium
          title="Lucro Líquido" value={fmtBRL(data.lucro_liquido)} sub="Faturamento − despesas"
          icon={<TrendingUp size={16} />}
          accent={data.lucro_liquido >= 0 ? "#4a8fd4" : "#ef4444"}
          change={changes.lucro} delay={0.12}
        />
        <KpiCardPremium
          title="Caixa" value={fmtBRL(data.caixa_disponivel)} sub="Saldo estimado"
          icon={<Wallet size={16} />}
          accent={data.caixa_disponivel >= 0 ? "#4a8fd4" : "#ef4444"}
          change={changes.caixa} delay={0.18}
        />
        <KpiCardPremium
          title="MRR" value={fmtBRL(data.mrr)} sub="Receita recorrente"
          icon={<Activity size={16} />} accent="#a78bfa"
          delay={0.24}
        />
      </div>

      {/* ── Row 2: Hero chart ──────────────────────────────────────────────── */}
      <HeroChart data={heroData} period={heroPeriod} onPeriodChange={setHeroPeriod} />

      {/* ── Row 3: Saúde Financeira + Projeção ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SaudeFinanceira data={data} />
        <ProjecaoFinanceira
          data={data}
          goal={goal ? { revenue_goal: goal.revenue_goal, margin_goal: goal.margin_goal } : null}
          receitaChange={changes.receita}
        />
      </div>

      {/* ── Row 4: Top Clientes ─────────────────────────────────────────────── */}
      <TopClientes
        clientes={topClientes}
        totalFaturamento={totalFaturamento}
        onVerTodos={onNavigateToTab ? () => onNavigateToTab("clientes") : undefined}
      />

      {/* ── Row 5: Insights ─────────────────────────────────────────────────── */}
      <InsightsFinanceiros
        data={data}
        receitaChange={changes.receita}
        despesaChange={changes.despesa}
        topCliente={topCliente}
      />

      {/* ── Row 6: Métricas Detalhadas (collapsible) ─────────────────────────── */}
      <MetricasDetalhadas data={data} />
    </div>
  );
}
