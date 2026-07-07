"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { motion } from "framer-motion";
import {
  Users, TrendingUp, CalendarDays, PhoneCall,
  CalendarCheck, BadgeDollarSign, Search, ChevronDown,
  Lightbulb, AlertTriangle, TrendingDown, Zap, Trash2, Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLeadsAnalytics, bucketOf } from "@/hooks/useLeadsAnalytics";
import { useLeadsAnalyticsData } from "@/hooks/useLeadsAnalyticsData";
import { usePipelineFilter } from "@/hooks/usePipelineFilter";
import { usePipelines } from "@/hooks/usePipelines";
import { PipelineFilter } from "@/components/crm/PipelineFilter";
import { KANBAN_COLUMNS } from "@/types";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// LeadsAnalytics
//
// Sub-módulo do CRM com métricas, gráficos, tabela de leads e insights automáticos.
// Todos os dados são derivados client-side do array de leads carregado pelo useLeads.
// ─────────────────────────────────────────────────────────────────────────────

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

const fmtPct = (v: number) => `${v.toFixed(1)}%`;

const fmtHours = (h: number | null) => {
  if (h === null) return "—";
  if (h < 24) return `${h}h`;
  return `${(h / 24).toFixed(1)}d`;
};

const BUCKET_COLORS: Record<string, string> = {
  "0-25":   "#ef4444",
  "26-50":  "#f59e0b",
  "51-75":  "#6366f1",
  "76-100": "#10b981",
};

const PIE_COLORS = ["#6366f1", "#4a8fd4", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6"];

const SOURCE_LABELS: Record<string, string> = {
  meta_lead_ads:    "Meta Lead Ads",
  manual:           "Manual",
  external_webhook: "Webhook",
};
function srcLabel(s: string): string {
  return SOURCE_LABELS[s] ?? s;
}

const STAGE_LABEL = Object.fromEntries(KANBAN_COLUMNS.map(c => [c.id, c.label]));

// ── Metric Card ────────────────────────────────────────────────────────────────

interface MetricCardProps {
  label:    string;
  value:    string | number;
  sub?:     string;
  icon:     React.ReactNode;
  accent:   string;
  positive?: boolean | null;
}

function MetricCard({ label, value, sub, icon, accent, positive }: MetricCardProps) {
  return (
    <div
      className="lc-card p-4 flex flex-col gap-2 min-w-0"
      style={{ background: "var(--dock-bg)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[var(--text-body)] truncate">{label}</p>
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${accent}18` }}
        >
          <span style={{ color: accent }}>{icon}</span>
        </span>
      </div>
      <p className="text-2xl font-bold text-[var(--text-title)] leading-none">{value}</p>
      {sub && (
        <p
          className={cn(
            "text-xs font-medium",
            positive === true  && "text-emerald-400",
            positive === false && "text-rose-400",
            positive === null  && "text-[var(--text-body)]",
          )}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

// ── Section Wrapper ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="text-sm font-semibold text-[var(--text-title)] mb-4 px-4 sm:px-6">{title}</h3>
      {children}
    </div>
  );
}

// ── Chart Card ────────────────────────────────────────────────────────────────

function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("lc-card p-4", className)} style={{ background: "var(--dock-bg)" }}>
      <p className="text-xs font-semibold text-[var(--text-body)] uppercase tracking-widest mb-4">{title}</p>
      {children}
    </div>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 text-sm"
      style={{
        background: "var(--chart-tooltip-bg)",
        border: "1px solid var(--chart-tooltip-border)",
        boxShadow: "0 8px 24px var(--shadow-md)",
      }}
    >
      {label && <p className="text-xs mb-1" style={{ color: "var(--chart-tooltip-label)" }}>{label}</p>}
      <p className="font-semibold" style={{ color: "var(--chart-tooltip-text)" }}>{payload[0].value}</p>
    </div>
  );
}

// ── Insight Card ──────────────────────────────────────────────────────────────

const INSIGHT_ICONS: Record<string, React.ReactNode> = {
  best_source: <Zap size={14} />,
  no_contact:  <AlertTriangle size={14} />,
  lead_drop:   <TrendingDown size={14} />,
  peak_day:    <Lightbulb size={14} />,
};

// ── Main Component ─────────────────────────────────────────────────────────────

export function LeadsAnalytics() {
  const { pipelines }                                   = usePipelines();
  const { value: selectedPipelineIds, onChange: setPipelineFilter } = usePipelineFilter();
  const { leads, stageHistory, stages, isLoading, bulkDeleteLeads } = useLeadsAnalyticsData(selectedPipelineIds);
  const analytics                                       = useLeadsAnalytics(leads, stageHistory, stages);

  const [search,       setSearch]       = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [stageFilter,  setStageFilter]  = useState("all");
  const [showAll,      setShowAll]      = useState(false);
  const [iqMin, setIqMin] = useState("");
  const [iqMax, setIqMax] = useState("");
  const [ieBucketFilter, setIeBucketFilter] = useState("all");

  // ── Seleção em lote ──────────────────────────────────────────────────────
  const [selectedIds,     setSelectedIds]     = useState<Set<string>>(new Set());
  const [bulkDeleteArmed, setBulkDeleteArmed] = useState(false);
  const [isBulkDeleting,  setIsBulkDeleting]  = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const activePipelines = useMemo(
    () => pipelines.filter(p => p.is_active),
    [pipelines],
  );

  const uniqueSources = useMemo(
    () => Array.from(new Set(leads.map(l => l.source || "manual"))),
    [leads],
  );

  const filteredLeads = useMemo(() => {
    const q = search.toLowerCase();
    const min = iqMin.trim() === "" ? null : Number(iqMin);
    const max = iqMax.trim() === "" ? null : Number(iqMax);
    return leads.filter(l => {
      if (q && !l.name.toLowerCase().includes(q) && !(l.contact ?? "").toLowerCase().includes(q)) return false;
      if (sourceFilter !== "all" && (l.source || "manual") !== sourceFilter) return false;
      if (stageFilter  !== "all" && l.kanban_column !== stageFilter)          return false;
      if (min !== null && (l.iq_score === null || l.iq_score < min)) return false;
      if (max !== null && (l.iq_score === null || l.iq_score > max)) return false;
      if (ieBucketFilter !== "all" && (l.ie_score === null || bucketOf(l.ie_score) !== ieBucketFilter)) return false;
      return true;
    });
  }, [leads, search, sourceFilter, stageFilter, iqMin, iqMax, ieBucketFilter]);

  const visibleLeads = showAll ? filteredLeads : filteredLeads.slice(0, 20);

  const allVisibleSelected  = visibleLeads.length > 0 && visibleLeads.every(l => selectedIds.has(l.id));
  const someVisibleSelected = visibleLeads.some(l => selectedIds.has(l.id));

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
    }
  }, [someVisibleSelected, allVisibleSelected]);

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleLeads.forEach(l => next.delete(l.id));
      else                    visibleLeads.forEach(l => next.add(l.id));
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (!bulkDeleteArmed) { setBulkDeleteArmed(true); return; }
    setIsBulkDeleting(true);
    setBulkDeleteError(null);
    const { error: err } = await bulkDeleteLeads(Array.from(selectedIds));
    setIsBulkDeleting(false);
    if (err) { setBulkDeleteError(err); return; }
    setSelectedIds(new Set());
    setBulkDeleteArmed(false);
  };

  if (isLoading) {
    return (
      <div className="px-4 sm:px-6 py-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "var(--card)" }} />
        ))}
      </div>
    );
  }

  return (
    <div className="pt-6">
      {/* ── Pipeline filter bar ─────────────────────────────────────────────── */}
      {activePipelines.length > 0 && (
        <div className="px-4 sm:px-6 pb-5 flex items-center gap-3">
          <PipelineFilter
            pipelines={activePipelines}
            value={selectedPipelineIds}
            onChange={setPipelineFilter}
          />
          {selectedPipelineIds !== null && selectedPipelineIds.length > 0 && (
            <p className="text-xs text-[var(--muted-foreground)]">
              {analytics.totalLeads} lead{analytics.totalLeads !== 1 ? "s" : ""} na seleção
            </p>
          )}
        </div>
      )}

      {/* ── Section 1: Metric cards ─────────────────────────────────────────── */}
      <Section title="Visão Geral">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 sm:px-6">
          <MetricCard
            label="Leads hoje"
            value={analytics.todayCount}
            icon={<CalendarDays size={14} />}
            accent="#6366f1"
          />
          <MetricCard
            label="Últimos 7 dias"
            value={analytics.last7Count}
            icon={<TrendingUp size={14} />}
            accent="#4a8fd4"
          />
          <MetricCard
            label="Últimos 30 dias"
            value={analytics.last30Count}
            sub={
              analytics.growthPct !== null
                ? `${analytics.growthPct >= 0 ? "+" : ""}${analytics.growthPct.toFixed(1)}% vs mês ant.`
                : undefined
            }
            positive={
              analytics.growthPct !== null ? analytics.growthPct >= 0 : null
            }
            icon={<TrendingUp size={14} />}
            accent="#10b981"
          />
          <MetricCard
            label="Total no funil"
            value={analytics.totalLeads}
            icon={<Users size={14} />}
            accent="#7d99ad"
          />
          <MetricCard
            label="Taxa de contato"
            value={fmtPct(analytics.contactRate)}
            sub="Chegaram a Em Andamento"
            positive={null}
            icon={<PhoneCall size={14} />}
            accent="#f59e0b"
          />
          <MetricCard
            label="Taxa de reunião"
            value={fmtPct(analytics.meetingRate)}
            sub="Reunião agendada ou realizada"
            positive={null}
            icon={<CalendarCheck size={14} />}
            accent="#8b5cf6"
          />
          <MetricCard
            label="Taxa de venda"
            value={fmtPct(analytics.saleRate)}
            sub="Venda realizada / total"
            positive={null}
            icon={<BadgeDollarSign size={14} />}
            accent="#10b981"
          />
          <MetricCard
            label="Vendas totais"
            value={analytics.stageFunnel.find(s => s.id === "venda_realizada")?.count ?? 0}
            icon={<BadgeDollarSign size={14} />}
            accent="#22c55e"
          />
        </div>
      </Section>

      {/* ── Section 1.5: Qualificação (IQ / IE) ─────────────────────────────── */}
      <Section title="Qualificação (IQ / IE)">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 px-4 sm:px-6 mb-4">
          <MetricCard
            label="IQ médio"
            value={analytics.avgIq ?? "—"}
            icon={<TrendingUp size={14} />}
            accent="#8b8fed"
          />
          <MetricCard
            label="IE médio"
            value={analytics.avgIe ?? "—"}
            icon={<TrendingUp size={14} />}
            accent="#34d399"
          />
          <MetricCard
            label="Maior IQ do mês"
            value={analytics.highestIqThisMonth?.score ?? "—"}
            sub={analytics.highestIqThisMonth?.name}
            icon={<TrendingUp size={14} />}
            accent="#10b981"
          />
          <MetricCard
            label="Menor IQ do mês"
            value={analytics.lowestIqThisMonth?.score ?? "—"}
            sub={analytics.lowestIqThisMonth?.name}
            icon={<TrendingDown size={14} />}
            accent="#f43f5e"
          />
          <MetricCard
            label="Tempo médio até IE 100"
            value={fmtHours(analytics.avgTimeToIe100Hours)}
            icon={<CalendarCheck size={14} />}
            accent="#6366f1"
          />
          <MetricCard
            label="Tempo médio entre faixas"
            value={fmtHours(analytics.avgTimeBetweenIeBracketsHours)}
            icon={<CalendarCheck size={14} />}
            accent="#f59e0b"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 sm:px-6">
          <ChartCard title="Leads por faixa de IQ">
            <div className="space-y-2">
              {analytics.iqBuckets.map(b => (
                <div key={b.range}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[var(--text-body)]">IQ {b.range}</span>
                    <span className="font-semibold text-[var(--text-title)] ml-2 flex-shrink-0">{b.count}</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: "var(--hover)" }}>
                    <motion.div
                      className="h-2 rounded-full"
                      style={{ background: BUCKET_COLORS[b.range] }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(...analytics.iqBuckets.map(x => x.count), 1) === 0 ? 0 : (b.count / Math.max(...analytics.iqBuckets.map(x => x.count), 1)) * 100}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>

          <ChartCard title="Leads por faixa de IE (estágio de evolução)">
            <div className="space-y-2">
              {analytics.ieBuckets.map(b => (
                <div key={b.range}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[var(--text-body)]">IE {b.range}</span>
                    <span className="font-semibold text-[var(--text-title)] ml-2 flex-shrink-0">{b.count}</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: "var(--hover)" }}>
                    <motion.div
                      className="h-2 rounded-full"
                      style={{ background: BUCKET_COLORS[b.range] }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(...analytics.ieBuckets.map(x => x.count), 1) === 0 ? 0 : (b.count / Math.max(...analytics.ieBuckets.map(x => x.count), 1)) * 100}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>

          <ChartCard title="IQ médio por origem" className="md:col-span-2">
            {analytics.avgIqBySource.length === 0 ? (
              <div className="h-[80px] flex items-center justify-center text-sm text-[var(--muted-foreground)]">Sem dados</div>
            ) : (
              <div className="space-y-2">
                {analytics.avgIqBySource.map(s => (
                  <div key={s.key} className="flex items-center gap-2 text-xs">
                    <span className="text-[var(--text-body)] flex-1 truncate">{s.label}</span>
                    <span className="text-[var(--muted-foreground)]">{s.count} lead{s.count !== 1 ? "s" : ""}</span>
                    <span className="font-semibold text-[var(--text-title)] w-10 text-right">{s.avg}</span>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        </div>
      </Section>

      {/* ── Section 2: Charts ───────────────────────────────────────────────── */}
      <Section title="Gráficos">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 sm:px-6">

          {/* Leads por dia */}
          <ChartCard title="Leads por dia (últimos 30 dias)">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={analytics.leadsPerDay} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  interval={6}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  width={28}
                />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#6366f1" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Distribuição por fonte */}
          <ChartCard title="Distribuição por fonte">
            {analytics.sourceBreakdown.length === 0 ? (
              <div className="h-[180px] flex items-center justify-center text-sm text-[var(--muted-foreground)]">
                Sem dados
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="60%" height={180}>
                  <PieChart>
                    <Pie
                      data={analytics.sourceBreakdown}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      innerRadius={40}
                      strokeWidth={0}
                    >
                      {analytics.sourceBreakdown.map((entry, i) => (
                        <Cell key={entry.source} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--chart-tooltip-bg)",
                        border: "1px solid var(--chart-tooltip-border)",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 flex-1 min-w-0">
                  {analytics.sourceBreakdown.map((src, i) => (
                    <div key={src.source} className="flex items-center gap-2 text-xs">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <span className="truncate text-[var(--text-body)]">{src.label}</span>
                      <span className="ml-auto font-semibold text-[var(--text-title)] flex-shrink-0">
                        {src.pct}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ChartCard>

          {/* Funil de etapas */}
          <ChartCard title="Funil de etapas">
            <div className="space-y-2">
              {analytics.stageFunnel.map(stage => (
                <div key={stage.id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[var(--text-body)] truncate max-w-[140px]">{stage.label}</span>
                    <span className="font-semibold text-[var(--text-title)] ml-2 flex-shrink-0">{stage.count}</span>
                  </div>
                  <div
                    className="h-2 rounded-full"
                    style={{ background: "var(--hover)" }}
                  >
                    <motion.div
                      className="h-2 rounded-full"
                      style={{ background: stage.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${stage.pct}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>

          {/* Conversão por fonte */}
          <ChartCard title="Conversão por fonte">
            {analytics.conversionBySource.length === 0 ? (
              <div className="h-[180px] flex items-center justify-center text-sm text-[var(--muted-foreground)]">
                Sem dados
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-4 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-widest pb-2 border-b border-[var(--border-card)]">
                  <span className="col-span-2">Fonte</span>
                  <span className="text-right">Leads</span>
                  <span className="text-right">Conv.</span>
                </div>
                {analytics.conversionBySource.map((src, i) => (
                  <div key={src.source} className="grid grid-cols-4 items-center gap-1">
                    <div className="col-span-2 flex items-center gap-2 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <span className="text-xs text-[var(--text-body)] truncate">{src.label}</span>
                    </div>
                    <span className="text-xs text-right text-[var(--text-title)]">{src.total}</span>
                    <div className="flex items-center justify-end gap-1">
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          src.rate >= 20 ? "text-emerald-400" :
                          src.rate >= 10 ? "text-amber-400" :
                          src.rate > 0  ? "text-rose-400" : "text-[var(--muted-foreground)]",
                        )}
                      >
                        {src.rate}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        </div>
      </Section>

      {/* ── Section 3: Lead Table ────────────────────────────────────────────── */}
      <Section title="Lista de Leads">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 px-4 sm:px-6 mb-4">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm flex-1 min-w-[180px]"
            style={{
              background: "var(--hover)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <Search size={13} className="text-[var(--muted-foreground)] flex-shrink-0" />
            <input
              type="text"
              placeholder="Buscar por nome ou contato..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent outline-none text-sm text-[var(--text-title)] placeholder:text-[var(--muted-foreground)] w-full"
            />
          </div>

          <div className="relative">
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 rounded-xl text-sm text-[var(--text-body)] outline-none lc-filter-control cursor-pointer"
            >
              <option value="all">Todas as fontes</option>
              {uniqueSources.map(s => (
                <option key={s} value={s}>{srcLabel(s)}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={stageFilter}
              onChange={e => setStageFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 rounded-xl text-sm text-[var(--text-body)] outline-none lc-filter-control cursor-pointer"
            >
              <option value="all">Todas as etapas</option>
              {KANBAN_COLUMNS.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] pointer-events-none" />
          </div>

          {/* IQ min/max */}
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm" style={{ background: "var(--hover)", border: "1px solid var(--glass-border)" }}>
            <span className="text-[10px] text-[var(--muted-foreground)] flex-shrink-0">IQ</span>
            <input
              type="number" min={0} max={100} placeholder="min"
              value={iqMin} onChange={e => setIqMin(e.target.value)}
              className="w-12 bg-transparent outline-none text-sm text-[var(--text-title)] placeholder:text-[var(--muted-foreground)]"
            />
            <span className="text-[var(--muted-foreground)]">–</span>
            <input
              type="number" min={0} max={100} placeholder="max"
              value={iqMax} onChange={e => setIqMax(e.target.value)}
              className="w-12 bg-transparent outline-none text-sm text-[var(--text-title)] placeholder:text-[var(--muted-foreground)]"
            />
          </div>

          {/* Faixa de IE */}
          <div className="relative">
            <select
              value={ieBucketFilter}
              onChange={e => setIeBucketFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 rounded-xl text-sm text-[var(--text-body)] outline-none lc-filter-control cursor-pointer"
            >
              <option value="all">Todas as faixas de IE</option>
              <option value="0-25">IE 0-25</option>
              <option value="26-50">IE 26-50</option>
              <option value="51-75">IE 51-75</option>
              <option value="76-100">IE 76-100</option>
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] pointer-events-none" />
          </div>
        </div>

        {/* Barra de ação em lote */}
        {selectedIds.size > 0 && (
          <div
            className="flex items-center gap-2 mx-4 sm:mx-6 mb-3 px-3 py-2 rounded-xl"
            style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            <p className="text-xs font-medium" style={{ color: "var(--text-title)" }}>
              {selectedIds.size} selecionado{selectedIds.size !== 1 ? "s" : ""}
            </p>
            <button
              type="button"
              onClick={() => { setSelectedIds(new Set()); setBulkDeleteArmed(false); }}
              className="text-xs px-2.5 py-1 rounded-lg transition-colors"
              style={{ color: "var(--muted-foreground)" }}
            >
              Limpar seleção
            </button>
            <div className="flex-1" />
            {bulkDeleteError && (
              <p className="text-[11px]" style={{ color: "#ef4444" }}>{bulkDeleteError}</p>
            )}
            {bulkDeleteArmed && !isBulkDeleting && (
              <button
                type="button"
                onClick={() => setBulkDeleteArmed(false)}
                className="text-xs px-2.5 py-1.5 rounded-lg"
                style={{ background: "var(--hover)", color: "var(--muted-foreground)" }}
              >
                Voltar
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleBulkDelete()}
              disabled={isBulkDeleting}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all disabled:opacity-50"
              style={{
                background: bulkDeleteArmed ? "#ef4444" : "transparent",
                color: bulkDeleteArmed ? "#fff" : "#ef4444",
                border: `1px solid rgba(239,68,68,${bulkDeleteArmed ? 0 : 0.3})`,
              }}
            >
              {isBulkDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              {bulkDeleteArmed ? `Confirmar exclusão (${selectedIds.size})` : "Excluir selecionados"}
            </button>
          </div>
        )}

        {/* Table */}
        <div className="px-4 sm:px-6">
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid var(--border-card)" }}
          >
            {/* Header */}
            <div
              className="grid items-center text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-widest px-4 py-3"
              style={{
                gridTemplateColumns: "24px 1fr 1fr 1fr 1fr 60px 60px 90px 90px",
                background: "var(--hover)",
                borderBottom: "1px solid var(--border-card)",
              }}
            >
              <input
                ref={headerCheckboxRef}
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectAllVisible}
                aria-label="Selecionar todos os leads exibidos"
                className="cursor-pointer"
              />
              <span>Nome</span>
              <span>Contato</span>
              <span>Fonte</span>
              <span>Etapa</span>
              <span className="text-right">IQ</span>
              <span className="text-right">IE</span>
              <span className="text-right">Valor</span>
              <span className="text-right">Entrada</span>
            </div>

            {/* Rows */}
            {filteredLeads.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-[var(--muted-foreground)]">
                Nenhum lead encontrado
              </div>
            ) : (
              <>
                {visibleLeads.map((lead, i) => {
                  const col = KANBAN_COLUMNS.find(c => c.id === lead.kanban_column);
                  return (
                    <div
                      key={lead.id}
                      className="grid items-center px-4 py-3 text-sm transition-colors hover:bg-[var(--hover)]"
                      style={{
                        gridTemplateColumns: "24px 1fr 1fr 1fr 1fr 60px 60px 90px 90px",
                        borderBottom: i < visibleLeads.length - 1
                          ? "1px solid var(--border-card)"
                          : undefined,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(lead.id)}
                        onChange={() => toggleOne(lead.id)}
                        aria-label={`Selecionar lead ${lead.name}`}
                        className="cursor-pointer"
                      />
                      <span className="text-[var(--text-title)] font-medium truncate pr-2">{lead.name}</span>
                      <span className="text-[var(--text-body)] truncate pr-2">{lead.contact || "—"}</span>
                      <span className="text-[var(--text-body)] truncate pr-2">{srcLabel(lead.source || "manual")}</span>
                      <span className="truncate pr-2">
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            background: `${col?.color ?? "#7d99ad"}18`,
                            color: col?.color ?? "#7d99ad",
                          }}
                        >
                          {col?.label ?? lead.kanban_column}
                        </span>
                      </span>
                      <span className="text-right text-xs font-semibold" style={{ color: lead.iq_score !== null ? "#8b8fed" : "var(--muted-foreground)" }}>
                        {lead.iq_score ?? "—"}
                      </span>
                      <span className="text-right text-xs font-semibold" style={{ color: lead.ie_score !== null ? "#34d399" : "var(--muted-foreground)" }}>
                        {lead.ie_score ?? "—"}
                      </span>
                      <span className="text-right text-[var(--text-body)] text-xs">
                        {lead.deal_value > 0 ? fmtBRL(lead.deal_value) : "—"}
                      </span>
                      <span className="text-right text-[var(--text-body)] text-xs">
                        {format(new Date(lead.created_at), "dd/MM/yy", { locale: ptBR })}
                      </span>
                    </div>
                  );
                })}
                {!showAll && filteredLeads.length > 20 && (
                  <button
                    onClick={() => setShowAll(true)}
                    className="w-full py-3 text-xs text-[#4a8fd4] hover:text-[var(--text-title)] transition-colors text-center"
                    style={{ borderTop: "1px solid var(--border-card)" }}
                  >
                    Ver mais {filteredLeads.length - 20} leads
                  </button>
                )}
              </>
            )}
          </div>

          {filteredLeads.length > 0 && (
            <p className="text-xs text-[var(--muted-foreground)] mt-2">
              {filteredLeads.length} lead{filteredLeads.length > 1 ? "s" : ""} exibido{filteredLeads.length > 1 ? "s" : ""}
            </p>
          )}
        </div>
      </Section>

      {/* ── Section 4: Auto insights ─────────────────────────────────────────── */}
      {analytics.insights.length > 0 && (
        <Section title="Insights automáticos">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-4 sm:px-6">
            {analytics.insights.map(insight => (
              <motion.div
                key={insight.type}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="lc-card p-4 flex items-start gap-3"
                style={{ background: "var(--dock-bg)" }}
              >
                <span
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: `${insight.color}18`, color: insight.color }}
                >
                  {INSIGHT_ICONS[insight.type] ?? <Lightbulb size={14} />}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-title)] mb-0.5">{insight.title}</p>
                  <p className="text-xs text-[var(--text-body)] leading-relaxed">{insight.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
