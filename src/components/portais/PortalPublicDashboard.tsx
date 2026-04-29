"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ComposedChart, Line, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Download, ChevronDown, Filter, TrendingUp, Users,
  DollarSign, Eye, MousePointer, BarChart2, Loader2, AlertTriangle,
  CalendarDays, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, subDays, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { PortalPublicData, PortalCampaignSummary } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

const fmtNum = (v: number) =>
  new Intl.NumberFormat("pt-BR").format(v);

const fmtPct = (v: number) => `${v.toFixed(2)}%`;

const PERIOD_OPTIONS = [
  { label: "Últimos 7 dias", value: "7d" },
  { label: "Últimos 30 dias", value: "30d" },
  { label: "Este mês", value: "month" },
  { label: "Mês anterior", value: "prev_month" },
  { label: "Últimos 90 dias", value: "90d" },
];

function getPeriodDates(period: string): { since: string; until: string } {
  const now = new Date();
  switch (period) {
    case "7d":   return { since: format(subDays(now, 7), "yyyy-MM-dd"), until: format(now, "yyyy-MM-dd") };
    case "30d":  return { since: format(subDays(now, 30), "yyyy-MM-dd"), until: format(now, "yyyy-MM-dd") };
    case "90d":  return { since: format(subDays(now, 90), "yyyy-MM-dd"), until: format(now, "yyyy-MM-dd") };
    case "prev_month": {
      const prev = subMonths(now, 1);
      return { since: format(startOfMonth(prev), "yyyy-MM-dd"), until: format(endOfMonth(prev), "yyyy-MM-dd") };
    }
    default: // "month"
      return { since: format(startOfMonth(now), "yyyy-MM-dd"), until: format(now, "yyyy-MM-dd") };
  }
}

// ── Custom chart tooltip ──────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2.5 text-xs shadow-2xl"
      style={{ background: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.09)" }}
    >
      {label && <p className="text-white/50 mb-1.5 font-medium">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-white/60">{p.name}:</span>
          <span className="text-white font-semibold">
            {p.name.includes("CPL") || p.name.includes("Invest")
              ? fmtBRL(p.value)
              : p.name.includes("CTR")
              ? fmtPct(p.value)
              : fmtNum(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, format: fmt, icon: Icon, color,
}: {
  label: string;
  value: number;
  format?: "brl" | "num" | "pct";
  icon: React.ElementType;
  color: string;
}) {
  const formatted =
    fmt === "brl" ? fmtBRL(value)
    : fmt === "pct" ? fmtPct(value)
    : fmtNum(Math.round(value));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="lc-portal-card rounded-2xl p-4"
      style={{ cursor: "default" }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${color}18`, border: `1px solid ${color}28` }}
        >
          <Icon size={15} style={{ color }} strokeWidth={1.8} />
        </div>
      </div>
      <p className="text-white/50 text-xs font-medium mb-1 uppercase tracking-wide">{label}</p>
      <p className="text-white font-bold text-xl leading-tight">{formatted}</p>
    </motion.div>
  );
}

// ── Filter Dropdown ───────────────────────────────────────────────────────────

function FilterSelect({
  value, onChange, options, placeholder, className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="lc-filter-control flex items-center gap-2 px-3 py-2 rounded-xl text-sm w-full"
      >
        <span className="flex-1 text-left truncate">
          {selected?.label ?? placeholder ?? "Selecionar..."}
        </span>
        <ChevronDown size={13} className={cn("text-white/40 transition-transform shrink-0", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute left-0 right-0 top-full mt-1.5 z-[9999] rounded-xl overflow-hidden shadow-2xl"
              style={{ background: "rgba(8,10,18,0.97)", border: "1px solid rgba(255,255,255,0.10)" }}
            >
              <div className="py-1 max-h-56 overflow-y-auto">
                {options.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { onChange(opt.value); setOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3.5 py-2 text-sm text-left transition-colors",
                      value === opt.value
                        ? "bg-[#27a3ff]/10 text-white"
                        : "text-white/55 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <span className="flex-1">{opt.label}</span>
                    {value === opt.value && <Check size={13} className="text-[#27a3ff] shrink-0" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

interface Props { slug: string }

export function PortalPublicDashboard({ slug }: Props) {
  const [data, setData] = useState<PortalPublicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [period, setPeriod]           = useState("month");
  const [accountId, setAccountId]     = useState("all");
  const [campaignId, setCampaignId]   = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { since, until } = useMemo(() => getPeriodDates(period), [period]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ since, until });
      if (accountId !== "all")  params.set("account_id", accountId);
      if (campaignId !== "all") params.set("campaign_id", campaignId);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/portal/${slug}/data?${params}`);
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Erro ao carregar dados");
        return;
      }
      setData(json);
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }, [slug, since, until, accountId, campaignId, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePrint = () => window.print();

  // Derived filter options
  const accountOptions = useMemo(() => {
    const opts = [{ label: "Todas as contas", value: "all" }];
    (data?.available_accounts ?? []).forEach(a => opts.push({ label: a.name, value: a.id }));
    return opts;
  }, [data]);

  const campaignOptions = useMemo(() => {
    const opts = [{ label: "Todas as campanhas", value: "all" }];
    (data?.available_campaigns ?? []).forEach(c => opts.push({ label: c.name, value: c.id }));
    return opts;
  }, [data]);

  const periodLabel = useMemo(() => {
    const opt = PERIOD_OPTIONS.find(o => o.value === period);
    return opt ? opt.label : period;
  }, [period]);

  // ── Render states ─────────────────────────────────────────────────────────

  if (!loading && error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#060606" }}>
        <div className="text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            <AlertTriangle size={28} className="text-red-400" strokeWidth={1.4} />
          </div>
          <h1 className="text-white font-semibold text-lg mb-2">
            {error === "Portal pausado" ? "Portal pausado" : "Portal não encontrado"}
          </h1>
          <p className="text-white/40 text-sm">
            {error === "Portal pausado"
              ? "Este dashboard está temporariamente indisponível."
              : "O link que você acessou não existe ou foi removido."}
          </p>
        </div>
      </div>
    );
  }

  const kpis = data?.kpis;
  const campaigns = data?.campaigns ?? [];

  // Funnel data
  const funnelData = [
    { name: "Alcance", value: kpis?.alcance ?? 0, fill: "#27a3ff" },
    { name: "Cliques", value: kpis?.cliques ?? 0, fill: "#66aed6" },
    { name: "Leads",   value: kpis?.leads   ?? 0, fill: "#22c55e" },
  ];


  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#060606" }}
    >
      {/* Background exato do portal */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: "url('/bg-portal.webp')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          opacity: 0.5,
          zIndex: 0,
        }}
      />

      {/* ── Header ────────────────────────────────────────────────────── */}
      <header
        className="relative z-50 sticky top-0"
        style={{
          background: "rgba(0,0,0,0.12)",
          backdropFilter: "blur(32px) saturate(200%)",
          WebkitBackdropFilter: "blur(32px) saturate(200%)",
          borderBottom: "1px solid rgba(255,255,255,0.09)",
          boxShadow: "0 1px 0 rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.2)",
        }}
      >
        {/* ── Linha 1: branding + botão PDF ────────────────────────── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <img
              src="/genesy-logoname.svg"
              alt="Genesy"
              className="h-5 sm:h-6 w-auto shrink-0"
              style={{ filter: "brightness(0) invert(1)" }}
            />
            {!loading && (
              <>
                <div className="w-px h-5 shrink-0" style={{ background: "rgba(255,255,255,0.18)" }} />
                <span className="text-white/65 text-[11px] sm:text-sm font-light tracking-[0.18em] uppercase truncate">
                  {data?.portal.client_name ?? data?.portal.name ?? ""}
                </span>
              </>
            )}
            {loading && <div className="h-4 w-28 rounded-lg bg-white/[0.06] animate-pulse" />}
          </div>

          <button
            onClick={handlePrint}
            className="lc-btn flex items-center gap-2 px-4 text-xs rounded-xl shrink-0 print:hidden"
            style={{ minHeight: "44px" }}
          >
            <Download size={14} />
            <span>PDF</span>
          </button>
        </div>

        {/* ── Filtros ───────────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3 sm:pb-4 print:hidden">

          {/* Mobile: layout em linhas ───────────────────────────── */}
          <div className="sm:hidden space-y-2">
            {/* Período — largura total */}
            <FilterSelect
              value={period}
              onChange={p => { setPeriod(p); setCampaignId("all"); }}
              options={PERIOD_OPTIONS}
              className="w-full"
            />

            {/* Conta — largura total, condicional */}
            {accountOptions.length > 2 && (
              <FilterSelect
                value={accountId}
                onChange={setAccountId}
                options={accountOptions}
                className="w-full"
              />
            )}

            {/* Campanhas | Status — grid 2 colunas */}
            <div className={cn("grid gap-2", campaignOptions.length > 2 ? "grid-cols-2" : "grid-cols-1")}>
              {campaignOptions.length > 2 && (
                <FilterSelect
                  value={campaignId}
                  onChange={setCampaignId}
                  options={campaignOptions}
                />
              )}
              <FilterSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { label: "Todos os status", value: "all" },
                  { label: "Ativas", value: "ativa" },
                  { label: "Pausadas", value: "pausada" },
                ]}
              />
            </div>
          </div>

          {/* Desktop: layout em linha ───────────────────────────── */}
          <div className="hidden sm:flex items-center gap-2 flex-wrap">
            <Filter size={13} className="text-white/30 shrink-0" />
            <FilterSelect
              value={period}
              onChange={p => { setPeriod(p); setCampaignId("all"); }}
              options={PERIOD_OPTIONS}
              className="min-w-[160px]"
            />
            {accountOptions.length > 2 && (
              <FilterSelect
                value={accountId}
                onChange={setAccountId}
                options={accountOptions}
                className="min-w-[180px]"
              />
            )}
            {campaignOptions.length > 2 && (
              <FilterSelect
                value={campaignId}
                onChange={setCampaignId}
                options={campaignOptions}
                className="min-w-[200px]"
              />
            )}
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { label: "Todos os status", value: "all" },
                { label: "Ativas", value: "ativa" },
                { label: "Pausadas", value: "pausada" },
              ]}
              className="min-w-[160px]"
            />
            <span className="ml-auto text-xs text-white/30">
              <CalendarDays size={12} className="inline mr-1" />
              {format(new Date(since), "dd/MM/yyyy")} – {format(new Date(until), "dd/MM/yyyy")}
            </span>
          </div>
        </div>
      </header>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 size={32} className="animate-spin text-[#27a3ff]/60 mx-auto mb-4" />
              <p className="text-white/40 text-sm">Carregando dados...</p>
            </div>
          </div>
        )}

        {!loading && (
          <>
            {/* ── Print header (only in print) ──────────────────────── */}
            <div className="hidden print:block mb-6">
              <h1 className="text-2xl font-bold mb-1">{data?.portal.name}</h1>
              {data?.portal.client_name && <p className="text-gray-500">{data.portal.client_name}</p>}
              <p className="text-gray-500 text-sm mt-1">Período: {periodLabel} · {since} a {until}</p>
            </div>

            {/* ── KPI Row ─────────────────────────────────────────── */}
            <section>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <KpiCard label="Investimento" value={kpis?.investimento ?? 0} format="brl" icon={DollarSign} color="#27a3ff" />
                <KpiCard label="Leads"        value={kpis?.leads        ?? 0} format="num" icon={Users}       color="#22c55e" />
                <KpiCard label="CPL"          value={kpis?.cpl          ?? 0} format="brl" icon={TrendingUp}  color="#f59e0b" />
                <KpiCard label="Alcance"      value={kpis?.alcance      ?? 0} format="num" icon={Eye}         color="#a78bfa" />
                <KpiCard label="Cliques"      value={kpis?.cliques      ?? 0} format="num" icon={MousePointer} color="#fb923c" />
                <KpiCard label="CTR"          value={kpis?.ctr          ?? 0} format="pct" icon={BarChart2}   color="#38bdf8" />
              </div>
            </section>

            {/* ── Chart Row 1: Performance + Funil ─────────────────── */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Performance no tempo */}
              <div className="lg:col-span-2 lc-portal-card rounded-2xl p-5">
                <h3 className="text-white font-semibold text-sm mb-4">Performance no tempo</h3>
                {data?.daily && data.daily.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart data={data.daily} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="gCPLPortal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f97316" stopOpacity={0.22} />
                          <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis
                        dataKey="data"
                        tickFormatter={v => format(new Date(v + "T00:00:00"), "dd/MM", { locale: ptBR })}
                        tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                        axisLine={false} tickLine={false}
                      />
                      <YAxis yAxisId="left" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmtBRL(v)} width={70} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                      <YAxis yAxisId="cpl" orientation="right" tick={false} axisLine={false} tickLine={false} width={0} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />
                      <Line yAxisId="left"  type="monotone" dataKey="investimento" name="Investimento" stroke="#27a3ff" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      <Line yAxisId="right" type="monotone" dataKey="leads"        name="Leads"        stroke="#22c55e" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      <Area
                        yAxisId="cpl"
                        type="monotone"
                        dataKey="cpl"
                        name="CPL"
                        stroke="#f97316"
                        strokeWidth={2}
                        fill="url(#gCPLPortal)"
                        dot={false}
                        activeDot={{ r: 4, fill: "#f97316", strokeWidth: 2, stroke: "rgba(0,0,0,0.6)" }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart label="Nenhum dado no período" />
                )}
              </div>

              {/* Funil */}
              <div className="lc-portal-card rounded-2xl p-5">
                <h3 className="text-white font-semibold text-sm mb-4">Funil</h3>
                <div className="space-y-2">
                  {funnelData.map((item, i) => {
                    const pct = funnelData[0].value > 0 ? (item.value / funnelData[0].value) * 100 : 0;
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-white/60 text-xs font-medium">{item.name}</span>
                          <span className="text-white text-sm font-semibold">{fmtNum(item.value)}</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.7, delay: i * 0.1 }}
                            className="h-full rounded-full"
                            style={{ background: item.fill }}
                          />
                        </div>
                        {i < funnelData.length - 1 && (
                          <p className="text-white/25 text-xs mt-0.5 text-right">{pct.toFixed(1)}% do alcance</p>
                        )}
                      </div>
                    );
                  })}
                </div>
                {funnelData.every(f => f.value === 0) && <EmptyChart label="Sem dados" />}
              </div>
            </section>

            {/* ── Distribuição de leads por campanha ───────────────── */}
            {campaigns.length > 0 && (
              <section className="lc-portal-card rounded-2xl p-5">
                <h3 className="text-white font-semibold text-sm mb-5">Distribuição por campanha</h3>
                <DonutCampaignChart campaigns={campaigns} />
              </section>
            )}

            {/* ── Campaign table ────────────────────────────────────── */}
            <section>
              <h3 className="text-white font-semibold text-sm mb-3">Detalhamento de campanhas</h3>
              {campaigns.length === 0 ? (
                <div className="lc-portal-card rounded-2xl p-8 text-center">
                  <p className="text-white/40 text-sm">Nenhuma campanha encontrada no período.</p>
                </div>
              ) : (
                <div className="lc-portal-card rounded-2xl overflow-hidden" style={{ padding: 0 }}>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/[0.07]">
                          {["Campanha", "Status", "Investimento", "Leads", "CPL", "CTR", "Impressões", "Cliques"].map(col => (
                            <th
                              key={col}
                              className="px-4 py-3.5 text-left text-xs font-semibold text-white/40 uppercase tracking-wider whitespace-nowrap"
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {campaigns.map((c, i) => (
                          <motion.tr
                            key={c.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors"
                          >
                            <td className="px-4 py-3">
                              <p className="text-white text-sm font-medium truncate max-w-[220px]">{c.nome}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={cn(
                                  "text-xs font-medium px-2 py-0.5 rounded-full capitalize",
                                  c.status === "ativa"
                                    ? "bg-emerald-500/10 text-emerald-400"
                                    : "bg-amber-500/10 text-amber-400"
                                )}
                              >
                                {c.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-white/80 text-sm">{fmtBRL(c.investimento)}</td>
                            <td className="px-4 py-3 text-white/80 text-sm font-semibold">{fmtNum(c.leads)}</td>
                            <td className="px-4 py-3 text-white/80 text-sm">{c.leads > 0 ? fmtBRL(c.cpl) : "—"}</td>
                            <td className="px-4 py-3 text-white/80 text-sm">{fmtPct(c.ctr)}</td>
                            <td className="px-4 py-3 text-white/60 text-sm">{fmtNum(c.impressoes)}</td>
                            <td className="px-4 py-3 text-white/60 text-sm">{fmtNum(c.cliques)}</td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            {/* Footer */}
            <footer className="text-center py-4 text-white/20 text-xs print:hidden">
              Dashboard gerado em tempo real · {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}
            </footer>
          </>
        )}
      </main>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body { background: #fff !important; color: #111 !important; }
          .lc-portal-card, .lc-modal-panel {
            background: #f8f8f8 !important;
            border: 1px solid #e5e7eb !important;
            box-shadow: none !important;
          }
          header { position: static !important; background: #fff !important; border-bottom: 1px solid #e5e7eb !important; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          * { color: #111 !important; }
          .text-white\\/40, .text-white\\/50, .text-white\\/60, .text-white\\/30 { color: #555 !important; }
        }
      `}</style>
    </div>
  );
}

const DONUT_COLORS = ["#27a3ff", "#22c55e", "#f59e0b", "#a78bfa", "#fb923c", "#38bdf8", "#6b7280"];

function DonutCampaignChart({ campaigns }: { campaigns: PortalCampaignSummary[] }) {
  const metric = (c: PortalCampaignSummary) => c.leads || c.cliques || c.impressoes || 0;
  const sorted = [...campaigns].sort((a, b) => metric(b) - metric(a));
  const total = sorted.reduce((sum, c) => sum + metric(c), 0);

  if (total === 0) return <EmptyChart label="Sem dados para distribuição" />;

  const top = sorted.slice(0, 5);
  const othersTotal = sorted.slice(5).reduce((sum, c) => sum + metric(c), 0);

  const chartData: { name: string; value: number }[] = top.map(c => ({
    name: c.nome.length > 26 ? c.nome.slice(0, 26) + "…" : c.nome,
    value: metric(c),
  }));
  if (othersTotal > 0) chartData.push({ name: "Outras campanhas", value: othersTotal });

  const metricLabel = sorted[0]?.leads > 0 ? "leads" : sorted[0]?.cliques > 0 ? "cliques" : "impressões";

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="shrink-0">
        <ResponsiveContainer width={180} height={180}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={54}
              outerRadius={82}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [fmtNum(Number(value)), metricLabel]}
              contentStyle={{
                background: "rgba(0,0,0,0.85)",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 10,
                fontSize: 12,
              }}
              labelStyle={{ color: "rgba(255,255,255,0.5)" }}
              itemStyle={{ color: "#fff" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="flex-1 space-y-2.5 min-w-0">
        {chartData.map((entry, i) => {
          const pct = ((entry.value / total) * 100).toFixed(1);
          return (
            <div key={i} className="flex items-center gap-2.5">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
              />
              <span className="text-white/55 text-xs flex-1 min-w-0 truncate">{entry.name}</span>
              <span className="text-white/35 text-xs shrink-0 tabular-nums">{fmtNum(entry.value)}</span>
              <span className="text-white text-xs font-semibold shrink-0 w-10 text-right tabular-nums">
                {pct}%
              </span>
            </div>
          );
        })}
        <p className="text-white/20 text-xs pt-1">Distribuição por {metricLabel}</p>
      </div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-32">
      <p className="text-white/25 text-sm">{label}</p>
    </div>
  );
}
