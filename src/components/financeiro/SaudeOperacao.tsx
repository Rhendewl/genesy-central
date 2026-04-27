"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, TrendingDown, Users, DollarSign,
  AlertTriangle, CheckCircle, Info, Clock,
  HeartPulse, Target, ArrowUpRight, ArrowDownRight,
  UserMinus, Zap, Shield,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAgencyClients } from "@/hooks/useAgencyClients";
import { useSaudeOperacao, type SaudeInsight } from "@/hooks/useSaudeOperacao";

// ─────────────────────────────────────────────────────────────────────────────
// SaudeOperacao — Módulo de Retenção e Saúde da Carteira
// ─────────────────────────────────────────────────────────────────────────────

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

const fmtPct = (v: number) => `${v.toFixed(1)}%`;

// ── Custom Tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-4 py-3 shadow-xl text-xs"
      style={{ background: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <p className="text-[#b4b4b4] mb-2 font-medium">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 mb-1 last:mb-0">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-[#c7e5ff]">{p.name}:</span>
          <span className="text-white font-semibold">
            {typeof p.value === "number" && p.name.toLowerCase().includes("mrr")
              ? fmtBRL(p.value)
              : p.name.toLowerCase().includes("%") || p.name.toLowerCase().includes("churn") || p.name.toLowerCase().includes("reten")
              ? fmtPct(p.value)
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  delay?: number;
}

function KpiCard({ label, value, sub, icon, accent, trend, trendLabel, delay = 0 }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="lc-card p-5 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${accent}22`, border: `1px solid ${accent}44`, color: accent }}>
          {icon}
        </div>
        {trend && trendLabel && (
          <span className={cn(
            "text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1",
            trend === "up" ? "text-emerald-400 bg-emerald-400/10" :
            trend === "down" ? "text-red-400 bg-red-400/10" :
            "text-[#b4b4b4] bg-white/5"
          )}>
            {trend === "up" ? <ArrowUpRight size={10} /> : trend === "down" ? <ArrowDownRight size={10} /> : null}
            {trendLabel}
          </span>
        )}
      </div>
      <div>
        <p className="text-xs text-[#b4b4b4] mb-1">{label}</p>
        <p className="text-2xl font-bold text-white leading-none">{value}</p>
        {sub && <p className="text-xs text-[#5a5a5a] mt-1.5">{sub}</p>}
      </div>
    </motion.div>
  );
}

// ── Insight Card ──────────────────────────────────────────────────────────────

const INSIGHT_CONFIG: Record<SaudeInsight["type"], {
  icon: React.ReactNode;
  border: string;
  bg: string;
  textColor: string;
  dot: string;
}> = {
  positive: {
    icon: <CheckCircle size={14} />,
    border: "border-emerald-500/25",
    bg: "bg-emerald-500/8",
    textColor: "text-emerald-400",
    dot: "bg-emerald-400",
  },
  warning: {
    icon: <AlertTriangle size={14} />,
    border: "border-amber-500/25",
    bg: "bg-amber-500/8",
    textColor: "text-amber-400",
    dot: "bg-amber-400",
  },
  critical: {
    icon: <Zap size={14} />,
    border: "border-red-500/25",
    bg: "bg-red-500/8",
    textColor: "text-red-400",
    dot: "bg-red-400",
  },
  neutral: {
    icon: <Info size={14} />,
    border: "border-white/10",
    bg: "bg-white/5",
    textColor: "text-[#b4b4b4]",
    dot: "bg-[#b4b4b4]",
  },
};

// ── Cohort cell helpers ───────────────────────────────────────────────────────

function cohortColor(pct: number): string {
  if (pct >= 80) return "text-emerald-400 bg-emerald-400/10";
  if (pct >= 60) return "text-[#4a8fd4] bg-[#4a8fd4]/10";
  if (pct >= 40) return "text-amber-400 bg-amber-400/10";
  if (pct > 0)   return "text-red-400 bg-red-400/10";
  return "text-[#5a5a5a] bg-white/5";
}

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  year: number;
  month: number;
}

export function SaudeOperacao({ year, month }: Props) {
  const { clients, isLoading } = useAgencyClients();
  const metrics = useSaudeOperacao(clients, year, month, isLoading);

  const hasData = clients.length > 0;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="lc-card h-28" />
          ))}
        </div>
        <div className="lc-card h-64" />
        <div className="lc-card h-64" />
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!hasData) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="lc-card p-16 text-center"
      >
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: "rgba(74,143,212,0.12)", border: "1px solid rgba(74,143,212,0.2)" }}>
          <HeartPulse size={28} style={{ color: "#4a8fd4" }} />
        </div>
        <h3 className="text-white font-semibold text-lg mb-2">Sem dados suficientes</h3>
        <p className="text-[#b4b4b4] text-sm max-w-xs mx-auto">
          Cadastre clientes com data de início de contrato para visualizar as métricas de saúde da operação.
        </p>
      </motion.div>
    );
  }

  const churnGood  = metrics.churn_rate < 5;
  const churnWarn  = metrics.churn_rate >= 5 && metrics.churn_rate < 10;
  const churnColor = churnGood ? "#10b981" : churnWarn ? "#f59e0b" : "#ef4444";

  const retentionColor =
    metrics.retention_rate >= 95 ? "#10b981" :
    metrics.retention_rate >= 90 ? "#4a8fd4" :
    metrics.retention_rate >= 80 ? "#f59e0b" : "#ef4444";

  const netGrowthPositive = metrics.mrr_net_growth >= 0;

  return (
    <div className="space-y-5">

      {/* ── 1. KPI Grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          label="LTV Médio"
          value={fmtBRL(metrics.ltv)}
          sub={`Ticket ${fmtBRL(metrics.avg_ticket)} × ${metrics.avg_permanence_months.toFixed(0)} meses`}
          icon={<Target size={18} />}
          accent="#4a8fd4"
          delay={0}
        />
        <KpiCard
          label="Permanência Média"
          value={`${metrics.avg_permanence_months.toFixed(1)} meses`}
          sub={metrics.avg_permanence_months >= 12 ? "Retenção forte" : metrics.avg_permanence_months >= 6 ? "Retenção moderada" : "Retenção baixa"}
          icon={<Clock size={18} />}
          accent="#a78bfa"
          delay={0.05}
        />
        <KpiCard
          label="Churn Rate"
          value={fmtPct(metrics.churn_rate)}
          sub={metrics.churned_count > 0 ? `${metrics.churned_count} cancelamento${metrics.churned_count > 1 ? "s" : ""} este mês` : "Nenhum cancelamento este mês"}
          icon={<TrendingDown size={18} />}
          accent={churnColor}
          trend={metrics.churn_rate === 0 ? "neutral" : churnGood ? "up" : "down"}
          trendLabel={churnGood ? "saudável" : churnWarn ? "atenção" : "crítico"}
          delay={0.10}
        />
        <KpiCard
          label="Retenção"
          value={fmtPct(metrics.retention_rate)}
          sub="100% − churn rate"
          icon={<Shield size={18} />}
          accent={retentionColor}
          delay={0.15}
        />
        <KpiCard
          label="Clientes Ativos"
          value={String(metrics.active_count)}
          sub={`MRR ${fmtBRL(metrics.mrr)}`}
          icon={<Users size={18} />}
          accent="#10b981"
          delay={0.20}
        />
        <KpiCard
          label="Crescimento Líquido MRR"
          value={`${netGrowthPositive ? "+" : ""}${fmtBRL(metrics.mrr_net_growth)}`}
          sub={metrics.mrr_lost > 0 ? `${fmtBRL(metrics.mrr_lost)} perdidos por churn` : "Sem perda de receita"}
          icon={netGrowthPositive ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
          accent={netGrowthPositive ? "#10b981" : "#ef4444"}
          trend={netGrowthPositive ? "up" : "down"}
          trendLabel={netGrowthPositive ? "crescendo" : "queda"}
          delay={0.25}
        />
      </div>

      {/* ── 2. Insights automáticos ──────────────────────────────────────────── */}
      <AnimatePresence>
        {metrics.insights.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="lc-card p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(74,143,212,0.15)", border: "1px solid rgba(74,143,212,0.25)" }}>
                <Zap size={13} style={{ color: "#4a8fd4" }} />
              </div>
              <p className="text-sm font-semibold text-white">Insights da Operação</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {metrics.insights.map((insight, i) => {
                const cfg = INSIGHT_CONFIG[insight.type];
                return (
                  <motion.div
                    key={insight.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={cn("rounded-xl p-3.5 border", cfg.bg, cfg.border)}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className={cn("mt-0.5 shrink-0", cfg.textColor)}>{cfg.icon}</span>
                      <div>
                        <p className={cn("text-sm font-semibold mb-0.5", cfg.textColor)}>{insight.title}</p>
                        <p className="text-xs text-[#b4b4b4] leading-relaxed">{insight.message}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 3A. Evolução mensal — Clientes & Cancelamentos ──────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="lc-card p-5"
      >
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.25)" }}>
            <TrendingUp size={13} style={{ color: "#a78bfa" }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Evolução da Base</p>
            <p className="text-[11px] text-[#5a5a5a]">Clientes ativos e cancelamentos — últimos 6 meses</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={metrics.monthly_evolution} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="mes" tick={{ fill: "#5a5a5a", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#5a5a5a", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }}
              formatter={(v) => <span style={{ color: "#b4b4b4" }}>{v}</span>}
            />
            <Area
              type="monotone"
              dataKey="ativos"
              name="Clientes Ativos"
              fill="rgba(74,143,212,0.12)"
              stroke="#4a8fd4"
              strokeWidth={2}
            />
            <Bar dataKey="cancelamentos" name="Cancelamentos" fill="#ef444488" radius={[3, 3, 0, 0]} />
          </ComposedChart>
        </ResponsiveContainer>
      </motion.div>

      {/* ── 3B. Churn vs Retenção ──────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.20 }}
        className="lc-card p-5"
      >
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.25)" }}>
            <Shield size={13} style={{ color: "#10b981" }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Churn × Retenção</p>
            <p className="text-[11px] text-[#5a5a5a]">Taxas mensais — últimos 6 meses</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={metrics.monthly_evolution} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="mes" tick={{ fill: "#5a5a5a", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#5a5a5a", fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
            <Tooltip content={<ChartTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }}
              formatter={(v) => <span style={{ color: "#b4b4b4" }}>{v}</span>}
            />
            <Area
              type="monotone"
              dataKey="retencao_pct"
              name="Retenção %"
              fill="rgba(16,185,129,0.10)"
              stroke="#10b981"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="churn_pct"
              name="Churn %"
              fill="rgba(239,68,68,0.10)"
              stroke="#ef4444"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* ── 3C. MRR saudável ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
        className="lc-card p-5"
      >
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(74,143,212,0.15)", border: "1px solid rgba(74,143,212,0.25)" }}>
            <DollarSign size={13} style={{ color: "#4a8fd4" }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Receita Saudável</p>
            <p className="text-[11px] text-[#5a5a5a]">MRR por mês — últimos 6 meses</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={metrics.monthly_evolution} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="mes" tick={{ fill: "#5a5a5a", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: "#5a5a5a", fontSize: 11 }}
              axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
            />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="mrr"
              name="MRR"
              fill="rgba(74,143,212,0.15)"
              stroke="#4a8fd4"
              strokeWidth={2.5}
            />
          </AreaChart>
        </ResponsiveContainer>
        {/* MRR breakdown */}
        <div className="grid grid-cols-3 gap-3 mt-4 pt-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {[
            { label: "MRR Atual",       value: fmtBRL(metrics.mrr),            color: "#4a8fd4" },
            { label: "Receita Perdida", value: fmtBRL(metrics.mrr_lost),        color: "#ef4444" },
            {
              label: "Crescimento Líquido",
              value: `${metrics.mrr_net_growth >= 0 ? "+" : ""}${fmtBRL(metrics.mrr_net_growth)}`,
              color: metrics.mrr_net_growth >= 0 ? "#10b981" : "#ef4444",
            },
          ].map(item => (
            <div key={item.label} className="text-center">
              <p className="text-[10px] text-[#5a5a5a] mb-1">{item.label}</p>
              <p className="text-sm font-bold" style={{ color: item.color }}>{item.value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── 4. Cohort / Permanência ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="lc-card overflow-hidden"
      >
        <div className="p-5 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.25)" }}>
              <Target size={13} style={{ color: "#f59e0b" }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Cohort de Permanência</p>
              <p className="text-[11px] text-[#5a5a5a]">Retenção por mês de entrada</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["Entrada", "Clientes", "1 mês", "3 meses", "6 meses"].map(h => (
                  <th key={h} className="text-left text-[#b4b4b4] font-medium px-5 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.cohort.map((row, i) => (
                <motion.tr
                  key={row.mes}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  className="hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-5 py-3 text-white font-medium capitalize">{row.mes}</td>
                  <td className="px-5 py-3 text-[#b4b4b4]">{row.entradas || "—"}</td>
                  {row.entradas === 0 ? (
                    <>
                      <td className="px-5 py-3 text-[#5a5a5a]">—</td>
                      <td className="px-5 py-3 text-[#5a5a5a]">—</td>
                      <td className="px-5 py-3 text-[#5a5a5a]">—</td>
                    </>
                  ) : (
                    <>
                      {[
                        { n: row.apos_1m, pct: row.apos_1m_pct },
                        { n: row.apos_3m, pct: row.apos_3m_pct },
                        { n: row.apos_6m, pct: row.apos_6m_pct },
                      ].map((cell, j) => (
                        <td key={j} className="px-5 py-3">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-semibold",
                            cohortColor(cell.pct)
                          )}>
                            {cell.n} <span className="opacity-70">({cell.pct.toFixed(0)}%)</span>
                          </span>
                        </td>
                      ))}
                    </>
                  )}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* ── 5. Tabela clientes encerrados ─────────────────────────────────── */}
      {metrics.churned_clients.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="lc-card overflow-hidden"
        >
          <div className="p-5 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.25)" }}>
                <UserMinus size={13} style={{ color: "#ef4444" }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Clientes Encerrados</p>
                <p className="text-[11px] text-[#5a5a5a]">{metrics.churned_clients.length} contrato{metrics.churned_clients.length > 1 ? "s" : ""} encerrado{metrics.churned_clients.length > 1 ? "s" : ""}</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {["Cliente", "Entrada", "Saída", "Tempo", "Receita Gerada", "Observações", "Status"].map(h => (
                    <th key={h} className="text-left text-xs text-[#b4b4b4] font-medium px-5 py-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.churned_clients.map((row, i) => (
                  <motion.tr
                    key={row.client.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-3">
                      <p className="text-white font-medium">{row.client.name}</p>
                      <p className="text-[11px] text-[#5a5a5a]">{row.client.contact_name ?? "—"}</p>
                    </td>
                    <td className="px-5 py-3 text-[#b4b4b4] whitespace-nowrap">
                      {row.client.contract_start
                        ? format(parseISO(row.client.contract_start), "MMM/yy", { locale: ptBR })
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-[#b4b4b4] whitespace-nowrap">
                      {row.client.contract_end
                        ? format(parseISO(row.client.contract_end), "MMM/yy", { locale: ptBR })
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-[#b4b4b4] whitespace-nowrap">
                      {row.tempo_meses > 0 ? `${row.tempo_meses}m` : "—"}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className={row.receita_total > 0 ? "text-white font-semibold" : "text-[#5a5a5a]"}>
                        {row.receita_total > 0 ? fmtBRL(row.receita_total) : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[#5a5a5a] text-xs max-w-[180px] truncate">
                      {row.client.notes ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn(
                        "text-xs font-medium px-2.5 py-1 rounded-full border",
                        row.client.status === "churned"
                          ? "text-red-400 bg-red-400/10 border-red-400/20"
                          : "text-[#b4b4b4] bg-[#b4b4b4]/10 border-[#b4b4b4]/20"
                      )}>
                        {row.client.status === "churned" ? "Churned" : "Inativo"}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ── 6. Contratos em risco ─────────────────────────────────────────── */}
      {metrics.at_risk_clients.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.30 }}
          className="lc-card p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.25)" }}>
              <AlertTriangle size={13} style={{ color: "#f59e0b" }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Contratos Vencendo em 60 Dias</p>
              <p className="text-[11px] text-[#5a5a5a]">Requer atenção proativa de renovação</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {metrics.at_risk_clients.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-xl p-3.5"
                style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)" }}
              >
                <p className="text-white font-medium text-sm">{c.name}</p>
                <p className="text-[11px] text-[#b4b4b4] mt-0.5">
                  Vence: {c.contract_end
                    ? format(parseISO(c.contract_end), "dd/MM/yyyy", { locale: ptBR })
                    : "—"}
                </p>
                <p className="text-amber-400 font-semibold text-sm mt-1.5">{fmtBRL(c.monthly_fee)}/mês</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
