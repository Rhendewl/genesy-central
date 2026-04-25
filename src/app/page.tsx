"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/layout/Header";
import {
  Users, Wallet, TrendingUp, BarChart3, ArrowUpRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
  XAxis,
  CartesianGrid,
  YAxis,
} from "recharts";
import { useLeads } from "@/hooks/useLeads";
import { useFinanceiroDashboard } from "@/hooks/useFinanceiroDashboard";
import { getSupabaseClient } from "@/lib/supabase";

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

// ─────────────────────────────────────────────────────────────────────────────
// Séries do gráfico financeiro
// ─────────────────────────────────────────────────────────────────────────────

const SERIES = [
  { key: "receitas", label: "Receitas", color: "#27f2e6" },
  { key: "despesas", label: "Despesas", color: "#fe7b4a" },
  { key: "mrr",      label: "MRR",      color: "#27a3ff" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Funil CRM
// ─────────────────────────────────────────────────────────────────────────────

const FUNNEL_STEPS = [
  { label: "Abordados", key: "abordados"  },
  { label: "Aplicações", key: "aplicacoes" },
  { label: "Reuniões",   key: "reunioes"   },
  { label: "Vendas",     key: "vendas"     },
] as const;

const FUNNEL_WIDTHS = ["100%", "81%", "63%", "45%"];

type FunnelCounts = Record<"abordados" | "aplicacoes" | "reunioes" | "vendas", number | null>;

function CRMFunnel({ counts }: { counts: FunnelCounts }) {
  const base = counts.abordados ?? 0;

  return (
    <div className="flex flex-col gap-2">
      {FUNNEL_STEPS.map((step, i) => {
        const count = counts[step.key];
        const pct   = base > 0 && count !== null ? Math.round((count / base) * 100) : null;

        return (
          <motion.div
            key={step.key}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.38, delay: 0.12 + i * 0.07, ease: "easeOut" }}
            className="flex items-center gap-2"
          >
            <div
              style={{
                width: FUNNEL_WIDTHS[i],
                background: "linear-gradient(to right, rgba(255,255,255,0.08), rgba(255,255,255,0.40))",
                border: "none",
                borderRadius: "11px",
              }}
              className="flex items-center justify-between px-4 py-[11px]"
            >
              <span className="text-[12px] font-semibold leading-none truncate" style={{ color: "rgba(255,255,255,0.85)" }}>
                {step.label}
              </span>
              <span className="ml-3 shrink-0 text-[14px] font-bold leading-none" style={{ color: "#ffffff" }}>
                {count === null ? "—" : count}
              </span>
            </div>
            <span className="w-8 shrink-0 text-right text-[10px] font-medium text-[var(--muted-foreground)]">
              {pct !== null && i > 0 ? `${pct}%` : ""}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Gráfico Financeiro — tooltip, dot e chart
// ─────────────────────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ dataKey: string; name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const visible = payload.filter((p) => p.name !== "");
  if (!visible.length) return null;

  return (
    <div
      style={{
        background: "rgba(0, 0, 0, 0.10)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "none",
        borderRadius: "12px",
        padding: "11px 14px",
        boxShadow: "none",
        minWidth: "172px",
      }}
    >
      <p style={{ color: "var(--chart-tooltip-label)", fontSize: "10px", fontWeight: 600,
        letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: "9px" }}>
        {label}
      </p>
      {visible.map((entry) => (
        <div key={entry.dataKey}
          style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
          <span style={{ display: "inline-block", width: "7px", height: "7px",
            borderRadius: "50%", backgroundColor: entry.color, flexShrink: 0 }} />
          <span style={{ color: "var(--chart-tooltip-entry)", fontSize: "11px", flex: 1 }}>
            {entry.name}
          </span>
          <span style={{ color: "var(--chart-tooltip-text)", fontSize: "12px", fontWeight: 700 }}>
            R$&nbsp;{Number(entry.value).toLocaleString("pt-BR")}
          </span>
        </div>
      ))}
    </div>
  );
}

function GlowDot({ cx, cy, color }: { cx?: number; cy?: number; color: string }) {
  if (cx == null || cy == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={9}  fill={color} fillOpacity={0.1} />
      <circle cx={cx} cy={cy} r={4}  fill={color} fillOpacity={0.35} />
      <circle cx={cx} cy={cy} r={2.5} fill={color} stroke="var(--chart-dot-stroke)" strokeWidth={1.5} />
    </g>
  );
}

type ChartPoint = { mes: string; receitas: number; despesas: number; mrr: number };
type Period = "6m" | "3m" | "30d";

const PERIODS: { key: Period; label: string }[] = [
  { key: "30d", label: "30d" },
  { key: "3m",  label: "3m"  },
  { key: "6m",  label: "6m"  },
];

function FinanceiroChart({ sixMonthData }: { sixMonthData: ChartPoint[] }) {
  const [period, setPeriod] = useState<Period>("6m");
  const [dailyData, setDailyData] = useState<ChartPoint[]>([]);
  const [dailyLoading, setDailyLoading] = useState(false);

  useEffect(() => {
    if (period !== "30d") return;
    setDailyLoading(true);
    const fetchDaily = async () => {
      try {
        const supabase = getSupabaseClient();
        const now = new Date();
        const start = new Date(now);
        start.setDate(start.getDate() - 29);
        const startStr = start.toISOString().split("T")[0];
        const endStr   = now.toISOString().split("T")[0];

        const [{ data: revenues }, { data: expenses }] = await Promise.all([
          supabase.from("revenues").select("amount, date, status").gte("date", startStr).lte("date", endStr),
          supabase.from("expenses").select("amount, date").gte("date", startStr).lte("date", endStr),
        ]);

        const map: Record<string, ChartPoint> = {};
        for (let i = 0; i < 30; i++) {
          const d = new Date(start);
          d.setDate(d.getDate() + i);
          const key = d.toISOString().split("T")[0];
          const dd  = d.getDate().toString().padStart(2, "0");
          const mm  = (d.getMonth() + 1).toString().padStart(2, "0");
          map[key] = { mes: `${dd}/${mm}`, receitas: 0, despesas: 0, mrr: 0 };
        }
        for (const r of (revenues ?? []) as { amount: number; date: string; status: string }[]) {
          if (r.status === "pago" && map[r.date]) map[r.date].receitas += Number(r.amount);
        }
        for (const e of (expenses ?? []) as { amount: number; date: string }[]) {
          if (map[e.date]) map[e.date].despesas += Number(e.amount);
        }
        setDailyData(Object.values(map));
      } finally {
        setDailyLoading(false);
      }
    };
    fetchDaily();
  }, [period]);

  const activeData =
    period === "30d" ? dailyData
    : period === "3m" ? sixMonthData.slice(-3)
    : sixMonthData;

  const visibleSeries = period === "30d"
    ? SERIES.filter(s => s.key !== "mrr")
    : SERIES;

  return (
    <div className="flex flex-col gap-4">
      {/* Legenda + filtros */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-5 flex-wrap">
          {visibleSeries.map((s) => (
            <div key={s.key} className="flex items-center gap-2">
              <span style={{ display: "inline-block", width: "22px", height: "2.5px",
                borderRadius: "2px", backgroundColor: s.color }} />
              <span style={{ color: s.color, fontSize: "10px", fontWeight: 600, opacity: 0.9 }}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPeriod(p.key); }}
              className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all"
              style={period === p.key ? {
                background: "rgba(39,163,255,0.12)",
                color: "#27a3ff",
                border: "1px solid rgba(39,163,255,0.30)",
              } : {
                color: "var(--muted-foreground)",
                background: "transparent",
                border: "1px solid transparent",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {dailyLoading ? (
        <div className="h-[160px] flex items-center justify-center">
          <span style={{ color: "var(--muted-foreground)", fontSize: "11px" }}>Carregando...</span>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={activeData} margin={{ top: 8, right: 6, left: -28, bottom: 0 }}>
            <defs>
              {SERIES.map((s) => (
                <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={s.color} stopOpacity={0.26} />
                  <stop offset="80%"  stopColor={s.color} stopOpacity={0.04} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0}    />
                </linearGradient>
              ))}
            </defs>

            <CartesianGrid strokeDasharray="2 8" stroke="var(--chart-grid)" horizontal vertical={false} />

            <XAxis
              dataKey="mes"
              tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 500 }}
              axisLine={false} tickLine={false} dy={6}
              interval={period === "30d" ? 4 : 0}
            />

            <YAxis hide />

            <Tooltip content={<ChartTooltip />}
              cursor={{ stroke: "var(--border)", strokeWidth: 1, strokeDasharray: "3 4" }} />

            {visibleSeries.map((s) => (
              <Area
                key={`line-${s.key}`}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={1.25}
                fill={`url(#grad-${s.key})`}
                dot={false}
                activeDot={(props) => (
                  <GlowDot
                    cx={(props as { cx?: number }).cx}
                    cy={(props as { cy?: number }).cy}
                    color={s.color}
                  />
                )}
                animationDuration={900}
                animationEasing="ease-out"
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MetricCard
// ─────────────────────────────────────────────────────────────────────────────

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  secondary?: { label: string; value: string };
  accent: string;
  loading?: boolean;
  delay?: number;
  href?: string;
}

function MetricCard({
  icon: Icon, label, value, secondary, accent, loading = false, delay = 0, href,
}: MetricCardProps) {
  const Tag = href ? motion.a : motion.div;

  return (
    <Tag
      {...(href ? { href } : {})}
      className={`lc-card p-5 flex flex-col justify-between${href ? " cursor-pointer group" : ""}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay, ease: "easeOut" }}
    >
      {/* Label + icon */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "#b4b4b4" }}>
          {label}
        </span>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg">
          <Icon size={14} style={{ color: "#ffffff" }} />
        </div>
      </div>

      {/* Value */}
      {loading ? (
        <div className="space-y-2">
          <div className="h-7 w-24 animate-pulse rounded-lg" style={{ background: "var(--shimmer-base)" }} />
          <div className="h-3 w-14 animate-pulse rounded-md" style={{ background: "var(--shimmer-light)" }} />
        </div>
      ) : (
        <>
          <p className="text-[1.65rem] font-bold leading-none tracking-tight text-[var(--text-title)]">
            {value}
          </p>
          {secondary && (
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[10px] text-[var(--muted-foreground)]">{secondary.label}</span>
              <span className="text-[11px] font-semibold" style={{ color: accent }}>
                {secondary.value}
              </span>
            </div>
          )}
        </>
      )}

    </Tag>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DashboardPage
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { leads, leadsByColumn, isLoading: leadsLoading } = useLeads();
  const now = new Date();
  const { data: finData } = useFinanceiroDashboard(now.getFullYear(), now.getMonth() + 1);

  const chartData: ChartPoint[] = (finData?.receita_vs_despesa ?? []).map((d, i) => ({
    mes: d.mes,
    receitas: d.receita,
    despesas: d.despesa,
    mrr: finData?.crescimento_mrr?.[i]?.mrr ?? 0,
  }));

  const saldoTotal = finData?.lucro_liquido ?? 0;
  const currentMRR = finData?.mrr ?? 0;

  const funnelCounts: FunnelCounts = leadsLoading
    ? { abordados: null, aplicacoes: null, reunioes: null, vendas: null }
    : {
        abordados:  leadsByColumn.abordados.length,
        aplicacoes: leadsByColumn.formulario_aplicado.length,
        reunioes:   leadsByColumn.reuniao_realizada.length,
        vendas:     leadsByColumn.venda_realizada.length,
      };

  const totalLeads = leadsLoading ? null : leads.length;

  return (
    <div className="dashboard-geral-bg">
      <div className="mx-auto max-w-6xl space-y-5 px-4 sm:px-6">
        <Header title="Dashboard" subtitle="Visão geral da operação" showLogo />

        {/* ── Linha de métricas ──────────────────────────────────────────────── */}
        <section>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-foreground)]">
            Visão Geral
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard
              icon={Users}
              label="Total de Leads"
              value={totalLeads === null ? "—" : String(totalLeads)}
              accent="#27a3ff"
              loading={leadsLoading}
              delay={0}
              href="/crm"
            />
            <MetricCard
              icon={Wallet}
              label="Saldo"
              value={fmtBRL(saldoTotal)}
              secondary={{ label: "MRR", value: fmtBRL(currentMRR) }}
              accent="#27f2e6"
              delay={0.07}
              href="/financeiro"
            />
            <MetricCard
              icon={TrendingUp}
              label="Total Investido"
              value="—"
              accent="#27a3ff"
              delay={0.14}
              href="/trafego"
            />
            <MetricCard
              icon={BarChart3}
              label="ROAS"
              value="—"
              accent="#fe7b4a"
              delay={0.21}
              href="/trafego"
            />
          </div>
        </section>

        {/* ── Módulos principais ─────────────────────────────────────────────── */}
        <section>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-foreground)]">
            Módulos
          </p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

            {/* CRM — Funil */}
            <motion.a
              href="/crm"
              className="lc-card group block cursor-pointer p-6"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.28, ease: "easeOut" }}
            >
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl">
                    <Users size={17} style={{ color: "#ffffff" }} />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold leading-tight" style={{ color: "#b4b4b4" }}>
                      CRM
                    </p>
                    <p className="text-[10px] text-[var(--muted-foreground)]">Funil de conversão</p>
                  </div>
                </div>
                <ArrowUpRight
                  size={15}
                  className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  style={{ color: "#27a3ff" }}
                />
              </div>

              <CRMFunnel counts={funnelCounts} />
            </motion.a>

            {/* Financeiro — Gráfico */}
            <motion.a
              href="/financeiro"
              className="lc-card group block cursor-pointer p-6 lg:col-span-2"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.34, ease: "easeOut" }}
            >
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl">
                    <Wallet size={17} style={{ color: "#ffffff" }} />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold leading-tight" style={{ color: "#b4b4b4" }}>
                      Financeiro
                    </p>
                    <p className="text-[10px] text-[var(--muted-foreground)]">Últimos 6 meses</p>
                  </div>
                </div>
                <ArrowUpRight
                  size={15}
                  className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  style={{ color: "#27f2e6" }}
                />
              </div>

              <FinanceiroChart sixMonthData={chartData} />
            </motion.a>
          </div>
        </section>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
          className="pb-2 text-center text-[11px] text-[var(--muted-foreground)]"
        >
          Dados financeiros e de tráfego disponíveis após configurar o Supabase.
        </motion.p>
      </div>
    </div>
  );
}
