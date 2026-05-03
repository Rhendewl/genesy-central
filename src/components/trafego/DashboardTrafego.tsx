"use client";

import { useMemo, useState } from "react";
import {
  LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign, Users, TrendingDown, Target,
  Eye, MousePointer2, Megaphone, Radio,
  Activity, ChevronDown, TrendingUp, AlertTriangle,
  Zap, ArrowRight,
} from "lucide-react";
import { subDays, format } from "date-fns";
import { useTrafegoMetrics } from "@/hooks/useTrafegoMetrics";
import { useTrafegoGeo } from "@/hooks/useTrafegoGeo";
import { cn } from "@/lib/utils";

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const fmtNum = (v: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v);
const fmtPct = (v: number) => `${v.toFixed(2)}%`;

// ── Period config ─────────────────────────────────────────────────────────────

type PeriodKey = "7d" | "30d" | "90d";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "7d",  label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "3 meses" },
];

function getPeriodDates(period: PeriodKey): { since: string; until: string } {
  const today = new Date();
  const until = format(today, "yyyy-MM-dd");
  const days = period === "7d" ? 6 : period === "30d" ? 29 : 89;
  const since = format(subDays(today, days), "yyyy-MM-dd");
  return { since, until };
}

// Returns the equivalent window immediately before the current period.
// e.g. "30d" current = today-29→today; prev = today-59→today-30
function getPrevPeriodDates(period: PeriodKey): { since: string; until: string } {
  const today = new Date();
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const until = format(subDays(today, days), "yyyy-MM-dd");
  const since = format(subDays(today, days * 2 - 1), "yyyy-MM-dd");
  return { since, until };
}

// ── Trend helpers ─────────────────────────────────────────────────────────────

// "volume": higher = better (leads, CTR, receita)
// "cost":   lower  = better (CPL, CPC, CPM)
type MetricType = "volume" | "cost";

function periodChange(current: number, previous: number): number | null {
  if (previous === 0 || current === 0) return null;
  return ((current - previous) / previous) * 100;
}

function TrendBadge({
  change,
  metricType = "volume",
}: {
  change: number | null;
  metricType?: MetricType;
}) {
  if (change === null) return null;
  if (Math.abs(change) < 0.5) {
    return (
      <span
        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
        style={{ color: "#b4b4b4", background: "rgba(180,180,180,0.10)" }}
        title="Comparado ao período anterior equivalente"
      >
        estável
      </span>
    );
  }

  // For cost metrics, a decrease is an improvement; for volume, an increase is.
  const isImprovement = metricType === "cost" ? change < 0 : change > 0;
  const color  = isImprovement ? "#10b981" : "#ef4444";
  const bgColor = isImprovement ? "rgba(16,185,129,0.10)" : "rgba(239,68,68,0.10)";

  const label = metricType === "cost"
    ? (isImprovement ? "mais eficiente" : "mais caro")
    : (isImprovement ? "cresceu" : "caiu");

  const tooltip = metricType === "cost"
    ? `Comparado ao período anterior — ${isImprovement ? "redução no custo = melhora de performance" : "aumento no custo = perda de eficiência"}`
    : `Comparado ao período anterior`;

  return (
    <span
      className="flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full cursor-default"
      style={{ color, background: bgColor }}
      title={tooltip}
    >
      {change < 0 ? <TrendingDown size={9} /> : <TrendingUp size={9} />}
      {Math.abs(change).toFixed(1)}%
      <span className="opacity-70 ml-0.5 hidden sm:inline">· {label}</span>
    </span>
  );
}

// ── Period selector UI ────────────────────────────────────────────────────────

function PeriodSelector({
  value, onChange, size = "sm",
}: {
  value: PeriodKey;
  onChange: (p: PeriodKey) => void;
  size?: "sm" | "xs";
}) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-lg"
      style={{ background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.07)" }}>
      {PERIODS.map(p => (
        <button key={p.key} onClick={() => onChange(p.key)}
          className={cn(
            "rounded-md font-medium transition-all",
            size === "xs" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
            value === p.key
              ? "text-white"
              : "text-[#b4b4b4] hover:text-white"
          )}
          style={value === p.key ? {
            background: "rgba(74,143,212,0.20)",
            color: "#4a8fd4",
          } : {}}>
          {p.label}
        </button>
      ))}
    </div>
  );
}

// ── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data, dataKey, color }: {
  data: Record<string, unknown>[];
  dataKey: string;
  color: string;
}) {
  if (!data?.length) return null;
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5}
          dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── KPI Card (premium) ────────────────────────────────────────────────────────

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

function KpiCardPremium({
  title, value, sub, icon, accent, change, metricType = "volume",
  sparklineData, sparklineKey, delay = 0,
}: KpiPremiumProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="lc-card p-5 flex flex-col gap-1 group relative overflow-hidden"
      style={{
        background: "linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
      }}
    >
      {/* Accent glow top-left */}
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

// ── Custom Tooltip ────────────────────────────────────────────────────────────

const CustomTooltip = ({
  active, payload, label,
  formatters = {},
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  formatters?: Record<string, (v: number) => string>;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-4 py-3 text-sm"
      style={{
        background: "rgba(0,0,0,0.10)",
        border: "1px solid rgba(255,255,255,0.10)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}>
      <p className="text-[#7a7a8a] text-[11px] mb-2 font-medium">{label}</p>
      {payload.map(p => {
        const fmt = formatters[p.name] ?? ((v: number) => String(v));
        return (
          <div key={p.name} className="flex items-center gap-2 mb-1 last:mb-0">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="text-[#c7e5ff] text-xs">{p.name}:</span>
            <span className="text-white font-semibold text-xs">{fmt(p.value)}</span>
          </div>
        );
      })}
    </div>
  );
};

// ── Hero Chart ────────────────────────────────────────────────────────────────

function HeroChart({
  data, period, onPeriodChange,
}: {
  data: { data: string; valor: number; leads: number }[];
  period: PeriodKey;
  onPeriodChange: (p: PeriodKey) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="lc-card p-6"
    >
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">Performance no Período</h3>
          <p className="text-[11px] mt-0.5" style={{ color: "#7a7a8a" }}>
            Investimento diário e leads gerados
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Legend */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 rounded-full bg-emerald-400" />
              <span className="text-[11px]" style={{ color: "#7a7a8a" }}>Investimento</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 rounded-full bg-[#4a8fd4]" />
              <span className="text-[11px]" style={{ color: "#7a7a8a" }}>Leads</span>
            </div>
          </div>
          <PeriodSelector value={period} onChange={onPeriodChange} size="xs" />
        </div>
      </div>

      {data.length === 0 || data.every(d => d.valor === 0 && d.leads === 0) ? (
        <div className="h-[200px] flex flex-col items-center justify-center gap-2">
          <Activity size={28} style={{ color: "#3a3a4a" }} />
          <p className="text-sm" style={{ color: "#5a5a6a" }}>Sem dados no período</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gInv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gLeads" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4a8fd4" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#4a8fd4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="data"
              tick={{ fill: "#5a5a6a", fontSize: 10 }}
              axisLine={false} tickLine={false}
              interval={Math.max(0, Math.floor(data.length / 8) - 1)}
            />
            <YAxis yAxisId="left"
              tick={{ fill: "#5a5a6a", fontSize: 10 }}
              axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              width={40}
            />
            <YAxis yAxisId="right" orientation="right"
              tick={{ fill: "#5a5a6a", fontSize: 10 }}
              axisLine={false} tickLine={false}
              allowDecimals={false}
              width={30}
            />
            <Tooltip
              content={
                <CustomTooltip
                  formatters={{ "Investimento": fmtBRL, "Leads": v => `${fmtNum(v)} leads` }}
                />
              }
            />
            <Line yAxisId="left" type="monotone" dataKey="valor" name="Investimento"
              stroke="#10b981" strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: "#0e151b" }}
            />
            <Line yAxisId="right" type="monotone" dataKey="leads" name="Leads"
              stroke="#4a8fd4" strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#4a8fd4", strokeWidth: 2, stroke: "#0e151b" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
}

// ── Funil de Performance ──────────────────────────────────────────────────────

// Log normalization: keeps bars readable even when values differ by orders of magnitude.
// minPct ensures no step becomes invisible.
function smartWidth(value: number, anchor: number, minPct = 26): number {
  if (anchor <= 0 || value <= 0) return minPct;
  return Math.max(minPct, Math.min(100,
    (Math.log(value + 1) / Math.log(anchor + 1)) * 100,
  ));
}

interface FunnelStep {
  key: string;
  label: string;
  sub: string;
  display: string;
  fillPct: number;
  color: string;
  icon: React.ReactNode;
}

interface MicroIndicator {
  text: string;
  color: string;
}

function FunnelStep({
  step, index, micro,
}: {
  step: FunnelStep;
  index: number;
  micro?: MicroIndicator | null;
}) {
  return (
    <div>
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.38, delay: 0.38 + index * 0.07 }}
        className="group"
      >
        {/* Outer track */}
        <div className="relative h-12 rounded-xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}>
          {/* Animated fill */}
          <motion.div
            className="absolute inset-y-0 left-0 rounded-xl"
            initial={{ width: 0 }}
            animate={{ width: `${step.fillPct}%` }}
            transition={{ duration: 0.75, delay: 0.45 + index * 0.09, ease: [0.22, 1, 0.36, 1] }}
            style={{
              background: `linear-gradient(90deg, ${step.color}28 0%, ${step.color}10 100%)`,
              borderRight: `1px solid ${step.color}35`,
            }}
          />
          {/* Subtle glow on hover */}
          <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{ background: `${step.color}06` }} />

          {/* Content */}
          <div className="absolute inset-0 flex items-center justify-between px-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${step.color}18`, color: step.color }}>
                {step.icon}
              </div>
              <div>
                <p className="text-[12px] font-semibold text-white leading-tight">{step.label}</p>
                <p className="text-[10px] leading-tight" style={{ color: "#5a5a6a" }}>{step.sub}</p>
              </div>
            </div>
            <span className="text-[14px] font-bold text-white tabular-nums">{step.display}</span>
          </div>
        </div>
      </motion.div>

      {/* Micro indicator connector */}
      {micro && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 + index * 0.07 }}
          className="flex items-center gap-2 py-1.5 pl-4"
        >
          <div className="flex flex-col gap-0.5">
            <div className="w-px h-2 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
            <div className="w-px h-2 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
          </div>
          <span className="text-[10px] font-medium" style={{ color: micro.color }}>
            {micro.text}
          </span>
        </motion.div>
      )}
    </div>
  );
}

interface FunnelBlockProps {
  year: number;
  month: number;
  platformAccountId?: string | null;
}

function FunnelBlock({ year, month, platformAccountId }: FunnelBlockProps) {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const { since, until } = useMemo(() => getPeriodDates(period), [period]);
  const { dashboard: data, isLoading } = useTrafegoMetrics(year, month, platformAccountId, since, until);

  const { steps, micros } = useMemo(() => {
    if (!data) return { steps: [], micros: [] };

    const { alcance_total: alc, ctr_medio: ctr, cliques_total: cli, leads_total: lds } = data;

    // CTR normalized on a 0–5% scale → 0–100% fill.
    // At 1% CTR the bar reaches 20%; at 3% it reaches 60%; at 5%+ it's full.
    const ctrFill = ctr > 0 ? Math.max(14, Math.min(100, (ctr / 5) * 100)) : 14;
    const ctrColor = ctr >= 1 ? "#4a8fd4" : ctr >= 0.5 ? "#f59e0b" : (ctr > 0 ? "#ef4444" : "#4a5568");

    const builtSteps: FunnelStep[] = [
      {
        key:     "alcance",
        label:   "Alcance",
        sub:     "pessoas alcançadas",
        display: alc > 0 ? fmtNum(alc) : "—",
        fillPct: 100,
        color:   "#a78bfa",
        icon:    <Radio size={12} />,
      },
      {
        key:     "ctr",
        label:   "CTR",
        sub:     "taxa de clique",
        display: ctr > 0 ? fmtPct(ctr) : "—",
        fillPct: ctrFill,
        color:   ctrColor,
        icon:    <Target size={12} />,
      },
      {
        key:     "cliques",
        label:   "Cliques",
        sub:     "cliques no link",
        display: cli > 0 ? fmtNum(cli) : "—",
        fillPct: smartWidth(cli, alc, 26),
        color:   "#06b6d4",
        icon:    <MousePointer2 size={12} />,
      },
      {
        key:     "leads",
        label:   "Leads",
        sub:     "leads gerados",
        display: lds > 0 ? fmtNum(lds) : "—",
        fillPct: smartWidth(lds, cli, 18),
        color:   "#10b981",
        icon:    <Users size={12} />,
      },
    ];

    // Micro indicators shown between steps
    const alcToCliRate = alc > 0 ? (cli / alc) * 100 : null;
    const cliToLedRate = cli > 0 ? (lds / cli) * 100 : null;

    const builtMicros: (MicroIndicator | null)[] = [
      data.cpm_medio > 0
        ? { text: `CPM: ${fmtBRL(data.cpm_medio)} por mil impressões`, color: "#a78bfa" }
        : null, // after Alcance
      alcToCliRate !== null
        ? {
            text: `${alcToCliRate.toFixed(2)}% do alcance gerou cliques`,
            color: alcToCliRate >= ctr ? "#10b981" : "#7a7a8a",
          }
        : null, // after CTR
      cliToLedRate !== null
        ? {
            text: `${cliToLedRate.toFixed(1)}% dos cliques viraram leads`,
            color: cliToLedRate >= 5 ? "#10b981" : cliToLedRate >= 2 ? "#f59e0b" : "#ef4444",
          }
        : null, // after Cliques
      null, // after Leads — CPL footer comes next
    ];

    return { steps: builtSteps, micros: builtMicros };
  }, [data]);

  if (isLoading) {
    return (
      <div className="lc-card p-6 flex flex-col gap-3 animate-pulse">
        <div className="flex items-start justify-between mb-2">
          <div className="flex flex-col gap-1.5">
            <div className="h-4 w-36 bg-white/5 rounded" />
            <div className="h-2.5 w-28 bg-white/[0.03] rounded" />
          </div>
          <div className="h-7 w-32 bg-white/[0.04] rounded-lg" />
        </div>
        {[100, 68, 50, 34].map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-white/[0.03]" style={{ opacity: 1 - i * 0.15 }} />
        ))}
        <div className="h-12 rounded-xl bg-white/[0.03] mt-1" />
      </div>
    );
  }

  const hasData = (data?.alcance_total ?? 0) > 0 || (data?.leads_total ?? 0) > 0 || (data?.ctr_medio ?? 0) > 0;
  const cpl = data?.cpl_medio ?? 0;
  const leads = data?.leads_total ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="lc-card p-6 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-white">Funil de Performance</h3>
          <p className="text-[11px] mt-0.5" style={{ color: "#7a7a8a" }}>
            Do alcance ao resultado financeiro
          </p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} size="xs" />
      </div>

      {!hasData ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-10">
          <Radio size={28} style={{ color: "#3a3a4a" }} />
          <p className="text-sm" style={{ color: "#5a5a6a" }}>Sem dados no período</p>
          <p className="text-[11px]" style={{ color: "#3a3a4a" }}>
            Sincronize campanhas para visualizar o funil
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col flex-1">
            {steps.map((step, i) => (
              <FunnelStep key={step.key} step={step} index={i} micro={micros[i]} />
            ))}
          </div>

          {/* CPL footer card */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.72 }}
            className="mt-4 rounded-xl px-4 py-3 flex items-center justify-between"
            style={{
              background: "linear-gradient(135deg, rgba(245,158,11,0.10) 0%, rgba(245,158,11,0.04) 100%)",
              border: "1px solid rgba(245,158,11,0.20)",
            }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(245,158,11,0.15)" }}>
                <DollarSign size={13} style={{ color: "#f59e0b" }} />
              </div>
              <div>
                <p className="text-[12px] font-semibold text-white leading-tight">CPL Médio</p>
                <p className="text-[10px]" style={{ color: "#7a7a8a" }}>custo por lead</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[17px] font-bold leading-tight" style={{ color: "#f59e0b" }}>
                {cpl > 0 ? fmtBRL(cpl) : "—"}
              </p>
              {leads > 0 && (
                <p className="text-[10px]" style={{ color: "#7a7a8a" }}>
                  {fmtNum(leads)} leads
                </p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}

// ── Top Campanhas ─────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  ativa:      { label: "Ativa",      color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  pausada:    { label: "Pausada",    color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  finalizada: { label: "Finalizada", color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
  em_revisao: { label: "Revisão",    color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  rascunho:   { label: "Rascunho",   color: "#6b7280", bg: "rgba(107,114,128,0.10)" },
};

function TopCampanhas({
  campanhas,
  onVerTodas,
}: {
  campanhas: { id: string; nome: string; status: string; spend: number; leads: number; cpl: number; ctr: number }[];
  onVerTodas?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="lc-card p-6 flex flex-col"
    >
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-white">Top Campanhas</h3>
          <p className="text-[11px] mt-0.5" style={{ color: "#7a7a8a" }}>
            Por leads gerados no período
          </p>
        </div>
        {onVerTodas && (
          <button onClick={onVerTodas}
            className="flex items-center gap-1 text-[11px] font-medium transition-colors hover:text-white"
            style={{ color: "#4a8fd4" }}>
            Ver todas <ArrowRight size={10} />
          </button>
        )}
      </div>

      {campanhas.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8">
          <Megaphone size={28} style={{ color: "#3a3a4a" }} />
          <p className="text-sm" style={{ color: "#5a5a6a" }}>Sem campanhas com dados</p>
        </div>
      ) : (
        <div className="flex flex-col gap-px">
          {/* Header */}
          <div className="grid gap-2 px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "#5a5a6a", gridTemplateColumns: "1fr 80px 52px 72px 56px" }}>
            <span>Campanha</span>
            <span className="text-right">Spend</span>
            <span className="text-right">Leads</span>
            <span className="text-right">CPL</span>
            <span className="text-center">Status</span>
          </div>

          {campanhas.map((c, i) => {
            const s = STATUS_META[c.status] ?? { label: c.status, color: "#b4b4b4", bg: "rgba(180,180,180,0.10)" };
            return (
              <motion.div key={c.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.45 + i * 0.05 }}
                className="grid gap-2 px-2 py-2.5 rounded-xl items-center group transition-colors hover:bg-white/[0.03]"
                style={{ gridTemplateColumns: "1fr 80px 52px 72px 56px" }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-bold w-4 text-center shrink-0"
                    style={{ color: i === 0 ? "#f59e0b" : "#5a5a6a" }}>
                    {i + 1}
                  </span>
                  <span className="text-[12px] text-white font-medium truncate"
                    title={c.nome}>{c.nome}</span>
                </div>
                <span className="text-[12px] font-medium text-right"
                  style={{ color: "#c7e5ff" }}>{fmtBRL(c.spend)}</span>
                <span className="text-[12px] font-bold text-right"
                  style={{ color: "#10b981" }}>{fmtNum(c.leads)}</span>
                <span className="text-[12px] font-medium text-right"
                  style={{ color: "#f59e0b" }}>
                  {c.cpl > 0 ? fmtBRL(c.cpl) : "—"}
                </span>
                <div className="flex justify-center">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ color: s.color, background: s.bg }}>
                    {s.label}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ── Insights ──────────────────────────────────────────────────────────────────

type InsightType = "success" | "info" | "warning" | "danger";

interface Insight {
  type: InsightType;
  icon: React.ReactNode;
  title: string;
  desc: string;
}

const INSIGHT_STYLES: Record<InsightType, { color: string; bg: string; border: string }> = {
  success: { color: "#10b981", bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.18)" },
  info:    { color: "#4a8fd4", bg: "rgba(74,143,212,0.08)",  border: "rgba(74,143,212,0.18)" },
  warning: { color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.18)" },
  danger:  { color: "#ef4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.18)" },
};

function useInsights(data: {
  leads_diario: { data: string; leads: number }[];
  cpl_diario: { data: string; cpl: number }[];
  investimento_diario: { data: string; valor: number }[];
  top_campanhas: { nome: string; leads: number; cpl: number }[];
  ctr_medio: number;
  leads_total: number;
} | null): Insight[] {
  return useMemo(() => {
    if (!data) return [];
    const result: Insight[] = [];

    // Best leads day
    const bestLead = [...data.leads_diario].sort((a, b) => b.leads - a.leads)[0];
    if (bestLead?.leads > 0) {
      result.push({
        type: "success",
        icon: <TrendingUp size={13} />,
        title: "Melhor dia em leads",
        desc: `${bestLead.data} gerou ${fmtNum(bestLead.leads)} leads`,
      });
    }

    // Lowest CPL day
    const cplDays = data.cpl_diario.filter(d => d.cpl > 0);
    const bestCpl = [...cplDays].sort((a, b) => a.cpl - b.cpl)[0];
    if (bestCpl) {
      result.push({
        type: "success",
        icon: <DollarSign size={13} />,
        title: "Menor CPL do período",
        desc: `${bestCpl.data} — CPL de ${fmtBRL(bestCpl.cpl)}`,
      });
    }

    // Top campaign highlight
    const topCamp = data.top_campanhas[0];
    if (topCamp?.leads > 0) {
      result.push({
        type: "info",
        icon: <Megaphone size={13} />,
        title: "Campanha destaque",
        desc: `"${topCamp.nome}" gerou ${fmtNum(topCamp.leads)} leads`,
      });
    }

    // CTR health
    if (data.ctr_medio > 0) {
      if (data.ctr_medio < 0.5) {
        result.push({
          type: "warning",
          icon: <Target size={13} />,
          title: "CTR abaixo do ideal",
          desc: `CTR médio de ${fmtPct(data.ctr_medio)} — recomendado acima de 1%`,
        });
      }
    }

    // Zero spend in last 3 days
    const recent3 = data.investimento_diario.slice(-3);
    if (recent3.length === 3 && recent3.every(d => d.valor === 0) && data.investimento_diario.some(d => d.valor > 0)) {
      result.push({
        type: "danger",
        icon: <AlertTriangle size={13} />,
        title: "Spend zerado recentemente",
        desc: `Sem investimento registrado nos últimos 3 dias`,
      });
    }

    // No leads at all
    if (data.leads_total === 0) {
      result.push({
        type: "warning",
        icon: <Users size={13} />,
        title: "Sem leads no período",
        desc: "Nenhum lead capturado. Verifique os anúncios ativos.",
      });
    }

    return result;
  }, [data]);
}

function InsightsBlock({ data }: { data: Parameters<typeof useInsights>[0] }) {
  const insights = useInsights(data);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="lc-card p-6"
    >
      <div className="flex items-center gap-2 mb-5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(74,143,212,0.15)" }}>
          <Activity size={13} style={{ color: "#4a8fd4" }} />
        </div>
        <div>
          <h3 className="text-base font-semibold text-white leading-none">Insights do Período</h3>
          <p className="text-[11px] mt-0.5" style={{ color: "#7a7a8a" }}>Análise automática dos dados</p>
        </div>
      </div>

      {insights.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.08)" }}>
            <Activity size={18} style={{ color: "#3a3a4a" }} />
          </div>
          <p className="text-sm" style={{ color: "#5a5a6a" }}>Sem dados suficientes para insights</p>
          <p className="text-[11px]" style={{ color: "#3a3a4a" }}>
            Sincronize suas campanhas para gerar análises
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {insights.map((ins, i) => {
            const s = INSIGHT_STYLES[ins.type];
            return (
              <motion.div key={i}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.55 + i * 0.06 }}
                className="rounded-xl p-3.5 flex items-start gap-3"
                style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: `${s.color}20`, color: s.color }}>
                  {ins.icon}
                </div>
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

// ── Secondary Metrics (collapsible) ──────────────────────────────────────────

function SecondaryMetrics({ data }: {
  data: {
    cpm_medio: number;
    impressoes_total: number;
    cliques_total: number;
    conversoes_total: number;
    campanhas_ativas: number;
    clientes_ativos_midia: number;
    taxa_conversao: number;
    cpc_medio: number;
  };
}) {
  const [open, setOpen] = useState(false);

  const items = [
    { label: "CPM Médio",        value: fmtBRL(data.cpm_medio),          icon: <Eye size={13} />,          color: "#a78bfa" },
    { label: "Impressões",       value: fmtNum(data.impressoes_total),    icon: <Eye size={13} />,          color: "#6b7280" },
    { label: "Cliques",          value: fmtNum(data.cliques_total),       icon: <MousePointer2 size={13} />, color: "#6b7280" },
    { label: "Conversões",       value: fmtNum(data.conversoes_total),    icon: <Zap size={13} />,          color: "#22c55e" },
    { label: "Taxa de Conv.",    value: fmtPct(data.taxa_conversao),      icon: <Activity size={13} />,     color: "#22c55e" },
    { label: "CPC Médio",        value: fmtBRL(data.cpc_medio),           icon: <DollarSign size={13} />,   color: "#b4b4b4" },
    { label: "Campanhas Ativas", value: fmtNum(data.campanhas_ativas),    icon: <Megaphone size={13} />,    color: "#4a8fd4" },
    { label: "Clientes em Mídia",value: fmtNum(data.clientes_ativos_midia), icon: <Radio size={13} />,     color: "#10b981" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="lc-card overflow-hidden"
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-5 text-left transition-colors hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">Métricas Detalhadas</span>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{ color: "#4a8fd4", background: "rgba(74,143,212,0.12)" }}>
            {items.length} indicadores
          </span>
        </div>
        <ChevronDown size={14}
          className={cn("transition-transform", open && "rotate-180")}
          style={{ color: "#5a5a6a" }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: "hidden" }}
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 pt-0">
              {items.map(item => (
                <div key={item.label}
                  className="rounded-xl p-3.5"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}>
                  <div className="flex items-center gap-1.5 mb-1.5" style={{ color: item.color }}>
                    {item.icon}
                    <p className="text-[10px] font-medium uppercase tracking-wider"
                      style={{ color: "#6a6a7a" }}>{item.label}</p>
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

// ── Skeleton ──────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="lc-card p-5 h-36 animate-pulse">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-xl bg-white/5" />
              <div className="h-2 bg-white/5 rounded w-20" />
            </div>
            <div className="h-8 bg-white/5 rounded w-28 mb-2" />
            <div className="h-2 bg-white/5 rounded w-16 mb-3" />
            <div className="h-9 bg-white/[0.03] rounded" />
          </div>
        ))}
      </div>
      <div className="lc-card h-72 animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="lc-card h-64 animate-pulse" />
        <div className="lc-card h-64 animate-pulse" />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  platformAccountId?: string | null;
  year: number;
  month: number;
  onNavigateToCampanhas?: () => void;
}

export function DashboardTrafego({ year, month, platformAccountId, onNavigateToCampanhas }: Props) {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [heroPeriod, setHeroPeriod] = useState<PeriodKey>("30d");

  const { since, until } = useMemo(() => getPeriodDates(period), [period]);
  const { since: heroSince, until: heroUntil } = useMemo(() => getPeriodDates(heroPeriod), [heroPeriod]);

  const { since: prevSince, until: prevUntil } = useMemo(() => getPrevPeriodDates(period), [period]);

  const { dashboard: data, isLoading } = useTrafegoMetrics(year, month, platformAccountId, since, until);
  const { dashboard: prevData }        = useTrafegoMetrics(year, month, platformAccountId, prevSince, prevUntil);
  const { geo, isLoading: geoLoading } = useTrafegoGeo(platformAccountId, since, until);

  const { dashboard: heroData } = useTrafegoMetrics(
    year, month, platformAccountId, heroSince, heroUntil,
  );

  // Merged daily data for hero chart
  const heroChartData = useMemo(() => {
    if (!heroData) return [];
    const map = new Map<string, { data: string; valor: number; leads: number }>();
    heroData.investimento_diario.forEach(d =>
      map.set(d.data, { data: d.data, valor: d.valor, leads: 0 })
    );
    heroData.leads_diario.forEach(d => {
      const e = map.get(d.data);
      if (e) e.leads = d.leads;
      else map.set(d.data, { data: d.data, valor: 0, leads: d.leads });
    });
    return Array.from(map.values());
  }, [heroData]);

  // % change current period vs previous equivalent period
  const changes = useMemo(() => {
    if (!data || !prevData) return { inv: null, leads: null, cpl: null };
    return {
      inv:   periodChange(data.investimento_total, prevData.investimento_total),
      leads: periodChange(data.leads_total,        prevData.leads_total),
      cpl:   periodChange(data.cpl_medio,          prevData.cpl_medio),
    };
  }, [data, prevData]);

  if (isLoading || !data) return <DashboardSkeleton />;

  return (
    <div className="space-y-5">
      {/* Global period filter */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-[12px]" style={{ color: "#5a5a6a" }}>
          Período de análise
        </p>
        <PeriodSelector value={period} onChange={p => { setPeriod(p); setHeroPeriod(p); }} />
      </div>

      {/* ── Row 1: 4 KPI cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCardPremium
          title="Investimento"
          value={fmtBRL(data.investimento_total)}
          sub="Spend no período"
          icon={<DollarSign size={16} />}
          accent="#10b981"
          change={changes.inv}
          sparklineData={data.investimento_diario as unknown as Record<string, unknown>[]}
          sparklineKey="valor"
          delay={0}
        />
        <KpiCardPremium
          title="Leads Totais"
          value={fmtNum(data.leads_total)}
          sub="Leads capturados"
          icon={<Users size={16} />}
          accent="#4a8fd4"
          change={changes.leads}
          sparklineData={data.leads_diario as unknown as Record<string, unknown>[]}
          sparklineKey="leads"
          delay={0.06}
        />
        <KpiCardPremium
          title="CPL Médio"
          value={data.cpl_medio > 0 ? fmtBRL(data.cpl_medio) : "—"}
          sub="Custo por lead"
          icon={<TrendingDown size={16} />}
          accent="#f59e0b"
          change={changes.cpl}
          metricType="cost"
          sparklineData={data.cpl_diario.filter(d => d.cpl > 0) as unknown as Record<string, unknown>[]}
          sparklineKey="cpl"
          delay={0.12}
        />
        <KpiCardPremium
          title="CTR Médio"
          value={data.ctr_medio > 0 ? fmtPct(data.ctr_medio) : "—"}
          sub="Taxa de clique"
          icon={<Target size={16} />}
          accent={data.ctr_medio >= 1 ? "#10b981" : data.ctr_medio >= 0.5 ? "#f59e0b" : "#ef4444"}
          delay={0.18}
        />
      </div>

      {/* ── Row 2: Hero chart ───────────────────────────────────────────── */}
      <HeroChart
        data={heroChartData}
        period={heroPeriod}
        onPeriodChange={setHeroPeriod}
      />

      {/* ── Row 3: Funil + Top Campanhas ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FunnelBlock year={year} month={month} platformAccountId={platformAccountId} />
        <TopCampanhas
          campanhas={data.top_campanhas}
          onVerTodas={onNavigateToCampanhas}
        />
      </div>

      {/* ── Row 4: Insights ─────────────────────────────────────────────── */}
      <InsightsBlock data={data} />

      {/* ── Row 5: Secondary metrics (collapsible) ──────────────────────── */}
      <SecondaryMetrics data={data} />
    </div>
  );
}
