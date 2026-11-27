"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle, Award, BadgeDollarSign, CalendarCheck2, CheckCircle2, Compass, Crown, Globe2, Info, Lightbulb, Loader2,
  Megaphone, Monitor, PieChart, Radar, Smartphone, Tablet, Tags, TrendingUp, XCircle,
} from "lucide-react";
import type { Lead } from "@/types";
import type { TimingEvent, TimingStage } from "@/lib/crm/operation-analytics";
import { durationLabel } from "@/lib/crm/operation-analytics";
import { analyzeOrigins, analyzeSegments, type OriginAnalysis, type OriginRow } from "@/lib/crm/origin-analytics";
import { buildTrackingInsights, trackingResolvers, type TrackingInsight } from "@/lib/crm/tracking";
import { useLeadOrigins } from "@/hooks/useLeadOrigins";
import { useLeadAttribution } from "@/hooks/useLeadAttribution";
import { useFinancialPrivacyStore, FINANCIAL_VALUE_MASK } from "@/store/financial-privacy";
import { Donut, PillSwitch, niceMax, nf, pctText, solidGradient, GRADIENTS } from "@/components/insights/kit";

const panel = "crm-analysis-panel";
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
type SortKey = "leads" | "meetingRate" | "saleRate" | "revenue";
type Money = (value: number | null) => string;

function useMoney(): Money {
  const hidden = useFinancialPrivacyStore(state => state.valuesHidden);
  return value => (value === null ? "—" : hidden ? FINANCIAL_VALUE_MASK : brl.format(value));
}

/** Cor da linha: a cadastrada (origem, canal) ou uma do degradê padrão. */
const colorOf = (row: OriginRow, index = 0) => row.color || GRADIENTS[index % GRADIENTS.length][1];

const deviceIcon = (key: string) => key === "mobile" ? <Smartphone size={13} /> : key === "tablet" ? <Tablet size={13} /> : <Monitor size={13} />;

// ── Peças ─────────────────────────────────────────────────────────────────────

function PanelHeader({ eyebrow, title, subtitle, icon, action }: { eyebrow: string; title: ReactNode; subtitle?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
    <div className="min-w-0"><p className="crm-analysis-eyebrow">{eyebrow}</p><h4 className="mt-1 text-base font-semibold text-[var(--text-title)]">{title}</h4>{subtitle && <p className="mt-1 text-xs text-[var(--muted-foreground)]">{subtitle}</p>}</div>
    {action ?? (icon && <span className="text-[var(--muted-foreground)]">{icon}</span>)}
  </div>;
}

function Highlight({ icon, label, name, value, detail, color }: { icon: ReactNode; label: string; name: string; value: string; detail: string; color: string }) {
  return <article className={`${panel} relative overflow-hidden`}>
    <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full" style={{ background: `radial-gradient(circle, ${color}33 0%, transparent 70%)` }} />
    <div className="relative">
      <div className="flex items-center gap-2 text-xs font-medium text-[var(--muted-foreground)]"><span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `${color}1f`, color }}>{icon}</span>{label}</div>
      <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-title)]"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: solidGradient(color) }} /><span className="truncate" title={name}>{name}</span></p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-[var(--text-title)] sm:text-3xl">{value}</p>
      <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">{detail}</p>
    </div>
  </article>;
}

const TONES: Record<TrackingInsight["tone"], { color: string; icon: ReactNode; label: string }> = {
  critical:  { color: "#f43f5e", icon: <XCircle size={15} />,       label: "Prioridade" },
  attention: { color: "#f59e0b", icon: <AlertTriangle size={15} />, label: "Atenção" },
  good:      { color: "#10b981", icon: <CheckCircle2 size={15} />,  label: "Destaque" },
  info:      { color: "#38bdf8", icon: <Info size={15} />,          label: "Leitura" },
};

function Insights({ items }: { items: TrackingInsight[] }) {
  if (!items.length) return <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-xs text-[var(--muted-foreground)]">Ainda não há diferenças relevantes entre as origens no período.</p>;
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
    {items.map(item => {
      const tone = TONES[item.tone];
      return <article key={item.id} className="rounded-2xl border p-4" style={{ borderColor: `${tone.color}40`, background: `linear-gradient(160deg, ${tone.color}14, transparent 60%)` }}>
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: tone.color }}>{tone.icon}{tone.label}</div>
        <h5 className="text-sm font-semibold leading-snug text-[var(--text-title)]">{item.title}</h5>
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted-foreground)]">{item.detail}</p>
      </article>;
    })}
  </div>;
}

function RateBar({ value, best, color }: { value: number; best: number; color: string }) {
  return <div className="flex items-center gap-2">
    <div className="h-1.5 flex-1 rounded-full bg-[var(--hover)]"><div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${best ? Math.max(value ? 4 : 0, (value / best) * 100) : 0}%`, background: solidGradient(color, 90) }} /></div>
    <strong className="w-11 text-right text-xs tabular-nums text-[var(--text-title)]">{pctText(value)}</strong>
  </div>;
}

/** Ranking de conversão de um recorte: leads, reunião, venda, receita e IQ. */
function Ranking({ analysis, money, selected, onSelect, limit = 8, iconFor, firstColumn = "Origem", unitShare = "dos leads" }: { analysis: OriginAnalysis; money: Money; selected?: string | null; onSelect?: (key: string) => void; limit?: number; iconFor?: (key: string) => ReactNode; firstColumn?: string; unitShare?: string }) {
  const [sort, setSort] = useState<SortKey>("leads");
  const [expanded, setExpanded] = useState(false);
  const sorted = useMemo(() => [...analysis.rows].sort((a, b) => b[sort] - a[sort] || b.leads - a.leads), [analysis.rows, sort]);
  const rows = expanded ? sorted : sorted.slice(0, limit);
  const best = { sale: Math.max(0, ...analysis.rows.map(r => r.saleRate)), meeting: Math.max(0, ...analysis.rows.map(r => r.meetingRate)) };
  const colors = new Map(analysis.rows.map((row, index) => [row.key, colorOf(row, index)]));
  if (!analysis.rows.length) return <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-xs text-[var(--muted-foreground)]">Sem dados para este recorte no período.</p>;
  return <div>
    <div className="mb-3 flex justify-end"><PillSwitch label="Ordenar" value={sort} onChange={setSort} options={[{ value: "leads", text: "Volume" }, { value: "meetingRate", text: "Reunião" }, { value: "saleRate", text: "Venda" }, { value: "revenue", text: "Receita" }]} /></div>
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead><tr className="text-[11px] text-[var(--muted-foreground)]">
          <th className="px-1 pb-2 font-medium">{firstColumn}</th><th className="px-2 pb-2 text-right font-medium">Leads</th><th className="w-[22%] px-2 pb-2 font-medium">Reunião</th><th className="w-[22%] px-2 pb-2 font-medium">Venda</th><th className="px-2 pb-2 text-right font-medium">Receita</th><th className="px-1 pb-2 text-right font-medium">IQ</th>
        </tr></thead>
        <tbody>{rows.map(row => {
          const color = colors.get(row.key) ?? "#64748b";
          return <tr key={row.key} onClick={onSelect ? () => onSelect(row.key) : undefined} className={`border-t border-[var(--border)] transition ${onSelect ? "cursor-pointer hover:bg-white/[0.03]" : ""} ${selected === row.key ? "bg-[var(--hover)]" : ""}`}>
            <td className="max-w-[220px] px-1 py-2.5">
              <span className="flex min-w-0 items-center gap-2">{iconFor ? <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-white" style={{ background: solidGradient(color) }}>{iconFor(row.key)}</span> : <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: solidGradient(color) }} />}<span className="truncate font-medium text-[var(--text-title)]" title={row.name}>{row.name}</span></span>
              <span className={`${iconFor ? "ml-8" : "ml-[18px]"} text-[10px] text-[var(--muted-foreground)]`}>{pctText(row.share)} {unitShare}</span>
            </td>
            <td className="px-2 py-2.5 text-right text-sm font-semibold tabular-nums text-[var(--text-title)]">{nf(row.leads)}</td>
            <td className="px-2 py-2.5"><RateBar value={row.meetingRate} best={best.meeting} color="#38bdf8" /><span className="text-[10px] text-[var(--muted-foreground)]">{nf(row.meetings)} {row.meetings === 1 ? "lead" : "leads"}</span></td>
            <td className="px-2 py-2.5"><RateBar value={row.saleRate} best={best.sale} color="#10b981" /><span className="text-[10px] text-[var(--muted-foreground)]">{nf(row.sales)} {row.sales === 1 ? "venda" : "vendas"}</span></td>
            <td className="px-2 py-2.5 text-right tabular-nums text-[var(--text-title)]">{row.revenue ? money(row.revenue) : "—"}</td>
            <td className="px-1 py-2.5 text-right tabular-nums text-[var(--text-title)]">{row.avgIq ?? "—"}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    {sorted.length > limit && <button type="button" onClick={() => setExpanded(v => !v)} className="mt-3 text-xs font-semibold text-sky-400 hover:underline">{expanded ? "Mostrar menos" : `Ver todos (${sorted.length})`}</button>}
  </div>;
}

/** Barras empilhadas: quantos leads chegaram de cada origem por dia/semana. */
function ArrivalChart({ analysis }: { analysis: OriginAnalysis }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const { rows, timeline, timelineUnit: unit } = analysis;
  const top = rows.slice(0, 5);
  const topKeys = new Set(top.map(r => r.key));
  const series = [...top.map((r, i) => ({ key: r.key, name: r.name, color: colorOf(r, i) })), ...(rows.length > 5 ? [{ key: "__outros", name: "Outras", color: "#94a3b8" }] : [])];
  const data = timeline.map(point => {
    const values: Record<string, number> = {};
    let outros = 0;
    for (const [key, count] of Object.entries(point.counts)) { if (topKeys.has(key)) values[key] = count; else outros += count; }
    if (outros) values.__outros = outros;
    return { key: point.key, values, total: Object.values(values).reduce((a, b) => a + b, 0) };
  });
  const H = 220, padL = 30, padR = 8, padT = 10, padB = 26;
  const innerW = Math.max(0, width - padL - padR), innerH = H - padT - padB;
  const step = innerW / Math.max(1, data.length);
  const max = niceMax(Math.max(1, ...data.map(d => d.total)));
  const barW = Math.max(2, Math.min(28, step * 0.7));
  const every = Math.ceil(data.length / Math.max(2, Math.floor(innerW / 56)));
  const label = (key: string) => key.slice(5).split("-").reverse().join("/");
  const active = hover !== null ? data[hover] : null;
  if (!data.length) return <div className="crm-analysis-empty"><PieChart size={22} /><p>Nenhum lead no período selecionado.</p></div>;
  return <div>
    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">{series.map(s => <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]"><span className="h-2.5 w-2.5 rounded-full" style={{ background: solidGradient(s.color) }} />{s.name}</span>)}</div>
    <div ref={box} className="relative w-full" style={{ height: H }} onMouseLeave={() => setHover(null)}>
      {width > 0 && <svg width={width} height={H} className="block" role="img" aria-label={`Leads por origem a cada ${unit === "day" ? "dia" : "semana"}`}
        onMouseMove={e => { const x = e.clientX - e.currentTarget.getBoundingClientRect().left - padL; setHover(Math.min(data.length - 1, Math.max(0, Math.floor(x / step)))); }}>
        {[0, 0.5, 1].map(f => <g key={f}><line x1={padL} x2={width - padR} y1={padT + innerH * (1 - f)} y2={padT + innerH * (1 - f)} stroke="var(--chart-grid)" /><text x={padL - 6} y={padT + innerH * (1 - f) + 4} textAnchor="end" fontSize={10} fill="var(--text-muted)">{nf(Math.round(max * f))}</text></g>)}
        {hover !== null && <rect x={padL + hover * step} y={padT} width={step} height={innerH} fill="var(--hover)" rx={4} />}
        {data.map((d, i) => {
          let y = padT + innerH;
          return <g key={d.key} opacity={hover === null || hover === i ? 1 : 0.55}>
            {series.map(s => {
              const v = d.values[s.key] ?? 0;
              if (!v) return null;
              const h = (v / max) * innerH;
              y -= h;
              return <rect key={s.key} x={padL + i * step + (step - barW) / 2} y={y} width={barW} height={Math.max(1, h - 1)} rx={Math.min(3, barW / 3)} fill={s.color} />;
            })}
          </g>;
        })}
        {data.map((d, i) => i % every === 0 && <text key={d.key} x={padL + i * step + step / 2} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--text-muted)">{label(d.key)}</text>)}
      </svg>}
      {active && hover !== null && <div className="pointer-events-none absolute top-2 z-10 min-w-[170px] rounded-xl border px-3 py-2 text-xs shadow-xl backdrop-blur-md" style={{ left: Math.min(width - 180, Math.max(0, padL + hover * step + step / 2 - 85)), background: "var(--chart-tooltip-bg)", borderColor: "var(--chart-tooltip-border)", color: "var(--chart-tooltip-text)" }}>
        <p className="mb-1 font-semibold">{unit === "week" ? `Semana de ${label(active.key)}` : new Date(`${active.key}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })} · {nf(active.total)}</p>
        {series.filter(s => active.values[s.key]).map(s => <p key={s.key} className="flex items-center justify-between gap-4"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.name}</span><strong className="tabular-nums">{nf(active.values[s.key])}</strong></p>)}
      </div>}
    </div>
  </div>;
}

function DetailList({ title, items, color }: { title: string; items: Array<{ name: string; leads: number; sales: number }>; color: string }) {
  if (!items.length) return null;
  const max = Math.max(...items.map(i => i.leads), 1);
  return <div>
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">{title}</p>
    <ul className="space-y-2.5">{items.map(item => <li key={item.name}>
      <div className="flex items-center justify-between gap-3 text-xs"><span className="truncate text-[var(--text-subtitle)]" title={item.name}>{item.name}</span><span className="shrink-0 tabular-nums text-[var(--muted-foreground)]"><strong className="text-[var(--text-title)]">{nf(item.leads)}</strong> leads · {nf(item.sales)} {item.sales === 1 ? "venda" : "vendas"}</span></div>
      <div className="mt-1 h-1.5 rounded-full bg-[var(--hover)]"><div className="h-1.5 rounded-full" style={{ width: `${Math.max(3, (item.leads / max) * 100)}%`, background: solidGradient(color, 90) }} /></div>
    </li>)}</ul>
  </div>;
}

function OriginDetail({ row, color, money }: { row: OriginRow; color: string; money: Money }) {
  const steps = [
    { label: "Leads", value: row.leads },
    { label: "Qualificados", value: row.qualified },
    { label: "Reunião agendada", value: row.meetings },
    { label: "Reunião realizada", value: row.meetingsHeld },
    { label: "Venda", value: row.sales },
  ];
  const hasDetail = row.campaigns.length || row.ads.length || row.forms.length;
  return <div className="space-y-5">
    <div className="space-y-1.5">
      {steps.map((step, i) => <div key={step.label} className="relative h-9 overflow-hidden rounded-lg bg-[var(--hover)]">
        <div className="absolute inset-y-0 left-0 rounded-lg transition-all duration-700" style={{ width: `${row.leads ? Math.max(step.value ? 3 : 0, (step.value / row.leads) * 100) : 0}%`, background: solidGradient(color, 90), opacity: 0.85 - i * 0.1 }} />
        <div className="relative flex h-full items-center justify-between px-3 text-xs"><span className="font-medium text-[var(--text-title)]">{step.label}</span><span className="tabular-nums"><strong className="text-[var(--text-title)]">{nf(step.value)}</strong> <span className="text-[var(--muted-foreground)]">{i ? pctText(row.leads ? (step.value / row.leads) * 100 : 0) : ""}</span></span></div>
      </div>)}
    </div>
    <div className="grid grid-cols-3 gap-2 text-xs">
      <div className="rounded-xl bg-[var(--hover)] p-3"><p className="text-[var(--muted-foreground)]">Receita</p><strong className="text-sm tabular-nums text-[var(--text-title)]">{money(row.revenue)}</strong></div>
      <div className="rounded-xl bg-[var(--hover)] p-3"><p className="text-[var(--muted-foreground)]">Ticket médio</p><strong className="text-sm tabular-nums text-[var(--text-title)]">{money(row.avgTicket)}</strong></div>
      <div className="rounded-xl bg-[var(--hover)] p-3"><p className="text-[var(--muted-foreground)]">1º atendimento</p><strong className="text-sm tabular-nums text-[var(--text-title)]">{durationLabel(row.medianFirstContactMs)}</strong></div>
    </div>
    {hasDetail ? <div className="space-y-4">
      <DetailList title="Campanhas" items={row.campaigns} color={color} />
      <DetailList title="Anúncios" items={row.ads} color={color} />
      <DetailList title="Formulários" items={row.forms} color={color} />
    </div> : <p className="rounded-xl border border-dashed border-[var(--border)] px-3 py-4 text-center text-[11px] text-[var(--muted-foreground)]">Os leads desta origem não trazem campanha, anúncio ou formulário identificados.</p>}
  </div>;
}

function SectionTitle({ id, eyebrow, heading, detail }: { id: string; eyebrow: string; heading: string; detail?: string }) {
  return <header id={id} className="scroll-mt-20 pt-3">
    <p className="crm-analysis-eyebrow">{eyebrow}</p>
    <h3 className="mt-1 text-lg font-semibold tracking-tight text-[var(--text-title)] sm:text-xl">{heading}</h3>
    {detail && <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">{detail}</p>}
  </header>;
}

const SECTIONS = [
  { id: "rastreio-origem", label: "Origem cadastrada", icon: <Tags size={14} /> },
  { id: "rastreio-canais", label: "Canais e UTMs", icon: <Globe2 size={14} /> },
  { id: "rastreio-campanhas", label: "Campanhas e criativos", icon: <Megaphone size={14} /> },
  { id: "rastreio-dispositivos", label: "Dispositivos", icon: <Smartphone size={14} /> },
];

// ── Aba ───────────────────────────────────────────────────────────────────────

export function LeadTrackingAnalytics({ leads, stages, history, firstContactMs }: { leads: Lead[]; stages: TimingStage[]; history: TimingEvent[]; firstContactMs?: Map<string, number | null> }) {
  const { origins } = useLeadOrigins();
  const money = useMoney();
  const leadIds = useMemo(() => leads.map(lead => lead.id), [leads]);
  const { attribution, isLoading, error } = useLeadAttribution(leadIds);
  const [selected, setSelected] = useState<string | null>(null);

  const base = useMemo(() => ({ leads, stages, history, firstContactMs }), [leads, stages, history, firstContactMs]);
  const r = useMemo(() => trackingResolvers(attribution), [attribution]);
  const origin = useMemo(() => analyzeOrigins({ ...base, origins }), [base, origins]);
  const channel = useMemo(() => analyzeSegments(base, r.channel), [base, r]);
  const traffic = useMemo(() => analyzeSegments(base, r.traffic), [base, r]);
  const campaign = useMemo(() => analyzeSegments(base, r.campaign), [base, r]);
  const creative = useMemo(() => analyzeSegments(base, r.creative), [base, r]);
  const form = useMemo(() => analyzeSegments(base, r.form), [base, r]);
  const device = useMemo(() => analyzeSegments(base, r.device), [base, r]);
  const browser = useMemo(() => analyzeSegments(base, r.browser), [base, r]);
  const os = useMemo(() => analyzeSegments(base, r.os), [base, r]);

  const tracked = leads.filter(lead => attribution[lead.id] || lead.leadgen_id || lead.source === "meta_lead_ads").length;
  const withSession = leads.filter(lead => attribution[lead.id]).length;
  const insights = useMemo(() => buildTrackingInsights({ origin, channel, traffic, campaign, device, totalLeads: leads.length, trackedLeads: tracked }), [origin, channel, traffic, campaign, device, leads.length, tracked]);

  const current = origin.rows.find(row => row.key === selected) ?? origin.rows[0] ?? null;
  const currentColor = current ? colorOf(current, origin.rows.indexOf(current)) : "#64748b";
  const minLeads = Math.max(3, Math.round(leads.length * 0.03));
  const pick = (analysis: OriginAnalysis, metric: "saleRate" | "meetingRate", exclude: string[] = []) => [...analysis.rows].filter(row => row.leads >= minLeads && !exclude.includes(row.key) && row[metric] > 0).sort((a, b) => b[metric] - a[metric] || b.leads - a.leads)[0];
  const biggest = origin.rows[0];
  const hasSales = origin.rows.some(row => row.sales > 0);
  const topChannel = pick(channel, hasSales ? "saleRate" : "meetingRate", ["sem_rastreio"]);
  const topCampaign = [...campaign.rows].sort((a, b) => b.sales - a.sales || b.meetings - a.meetings || b.leads - a.leads)[0];
  const topRevenue = [...origin.rows].filter(row => row.revenue > 0).sort((a, b) => b.revenue - a.revenue)[0];
  const donutRows = (analysis: OriginAnalysis) => analysis.rows.map((row, index) => ({ name: row.key, label: row.name, value: row.leads, color: colorOf(row, index) }));

  if (!leads.length) return <div className={`${panel} crm-analysis-empty`}><Radar size={24} /><p>Nenhum lead no período selecionado.</p></div>;

  return <div className="space-y-5">
    {/* Cobertura do rastreio + navegação */}
    <div className="relative flex flex-wrap items-center gap-4 overflow-hidden rounded-2xl border p-4" style={{ background: "var(--glass-bg)", borderColor: "var(--glass-border)", boxShadow: "var(--glass-shadow)" }}>
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-32 h-72 w-72 rounded-full" style={{ background: "radial-gradient(circle, #0ea5e955 0%, transparent 68%)", opacity: 0.5 }} />
      <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: "linear-gradient(135deg, #0284c7, #38bdf8)" }}><Radar size={18} /></span>
      <div className="relative min-w-[220px] flex-1">
        <p className="text-sm text-[var(--text-title)]"><strong className="text-base">{pctText(leads.length ? (tracked / leads.length) * 100 : 0)}</strong> dos leads com origem rastreada · <strong>{nf(tracked)}</strong> de <strong>{nf(leads.length)}</strong></p>
        <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">{nf(withSession)} com UTM, dispositivo e navegador (formulários e site) · demais pelo anúncio do Meta ou sem rastreio.</p>
      </div>
      {isLoading && <span className="relative flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]"><Loader2 size={12} className="animate-spin" />Carregando rastreio…</span>}
      {error && <span className="relative text-[11px] text-amber-500">{error}</span>}
    </div>

    <nav aria-label="Seções do rastreamento" className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
      {SECTIONS.map(section => <a key={section.id} href={`#${section.id}`} className="flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--border)] px-3 text-xs font-semibold text-[var(--text-subtitle)] transition hover:bg-white/5">{section.icon}{section.label}</a>)}
    </nav>

    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {biggest && <Highlight icon={<Crown size={16} />} label="Origem com mais leads" name={biggest.name} value={pctText(biggest.share)} detail={`${nf(biggest.leads)} de ${nf(origin.total)} leads`} color={colorOf(biggest, 0)} />}
      {topChannel
        ? <Highlight icon={<Award size={16} />} label={`Canal que mais converte ${hasSales ? "em venda" : "em reunião"}`} name={topChannel.name} value={pctText(hasSales ? topChannel.saleRate : topChannel.meetingRate)} detail={`${nf(hasSales ? topChannel.sales : topChannel.meetings)} de ${nf(topChannel.leads)} leads`} color={colorOf(topChannel, channel.rows.indexOf(topChannel))} />
        : <Highlight icon={<Award size={16} />} label="Canal que mais converte" name="Ainda sem conversões" value="—" detail="Nenhum canal com reunião ou venda no período" color="#64748b" />}
      {topCampaign
        ? <Highlight icon={<CalendarCheck2 size={16} />} label="Campanha que mais gerou negócio" name={topCampaign.name} value={nf(topCampaign.leads)} detail={`leads · ${nf(topCampaign.meetings)} reuniões · ${nf(topCampaign.sales)} vendas`} color="#38bdf8" />
        : <Highlight icon={<CalendarCheck2 size={16} />} label="Campanhas" name="Sem campanhas identificadas" value="—" detail="Use UTM nos links dos anúncios" color="#64748b" />}
      {topRevenue
        ? <Highlight icon={<BadgeDollarSign size={16} />} label="Origem com maior receita" name={topRevenue.name} value={money(topRevenue.revenue)} detail={`ticket médio ${money(topRevenue.avgTicket)}`} color={colorOf(topRevenue, origin.rows.indexOf(topRevenue))} />
        : <Highlight icon={<Compass size={16} />} label="Canais ativos" name={`${nf(channel.rows.length)} ${channel.rows.length === 1 ? "canal" : "canais"}`} value={nf(channel.rows.length)} detail="trouxeram leads no período" color="#0ea5e9" />}
    </div>

    <section className={panel}>
      <PanelHeader eyebrow="Leitura rápida" title="O que mais converte — e o que merece atenção" icon={<Lightbulb size={18} />} />
      <Insights items={insights} />
    </section>

    {/* Origem cadastrada */}
    <SectionTitle id="rastreio-origem" eyebrow="Origem cadastrada" heading="Pela origem configurada no CRM e nos formulários" detail="É a etiqueta de origem gravada em cada lead (ex.: Formulário, Meta Lead Ads, Instagram, Indicação)." />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]">
      <section className={panel}>
        <PanelHeader eyebrow="Distribuição" title="% dos leads por origem" subtitle="Toque em uma origem para ver o detalhe." icon={<PieChart size={18} />} />
        <Donut rows={donutRows(origin)} unit="leads" limit={7} selected={selected} onSelect={key => setSelected(cur => (cur === key ? null : key))} />
      </section>
      <section className={panel}>
        <PanelHeader eyebrow="Ranking" title="Conversão por origem" subtitle="Reunião e venda contam quem passou por essas etapas, mesmo que tenha avançado depois." />
        <Ranking analysis={origin} money={money} selected={current?.key} onSelect={key => setSelected(key)} />
      </section>
    </div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <section className={panel}>
        <PanelHeader eyebrow="Ritmo de chegada" title={`Leads por origem a cada ${origin.timelineUnit === "day" ? "dia" : "semana"}`} subtitle="Passe o mouse sobre uma barra para ver a composição." icon={<TrendingUp size={18} />} />
        <ArrivalChart analysis={origin} />
      </section>
      {current && <section className={panel}>
        <PanelHeader eyebrow="Detalhe da origem" title={<span className="flex items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-full" style={{ background: solidGradient(currentColor) }} />{current.name}</span>} subtitle={`${nf(current.leads)} leads · ${pctText(current.share)} do total`} icon={<Megaphone size={18} />} />
        <OriginDetail row={current} color={currentColor} money={money} />
      </section>}
    </div>

    {/* Canais e UTMs */}
    <SectionTitle id="rastreio-canais" eyebrow="Canais e UTMs" heading="De qual plataforma o lead veio" detail="Pela UTM do link (utm_source); sem UTM, pelo site ou app de onde a pessoa chegou. Leads do formulário nativo do Meta entram como Meta." />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]">
      <section className={panel}>
        <PanelHeader eyebrow="Distribuição" title="% dos leads por canal" icon={<Globe2 size={18} />} />
        <Donut rows={donutRows(channel)} unit="leads" limit={7} />
        <div className="mt-6 border-t border-[var(--border)] pt-4">
          <p className="mb-3 text-xs font-semibold text-[var(--text-title)]">Tipo de tráfego</p>
          <div className="space-y-2.5">{traffic.rows.map((row, index) => <div key={row.key}>
            <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-[var(--text-subtitle)]"><span className="h-2.5 w-2.5 rounded-full" style={{ background: solidGradient(colorOf(row, index)) }} />{row.name}</span><span className="tabular-nums text-[var(--muted-foreground)]"><strong className="text-[var(--text-title)]">{nf(row.leads)}</strong> · {pctText(row.share)} · {pctText(hasSales ? row.saleRate : row.meetingRate)} {hasSales ? "venda" : "reunião"}</span></div>
            <div className="mt-1 h-1.5 rounded-full bg-[var(--hover)]"><div className="h-1.5 rounded-full" style={{ width: `${Math.max(2, row.share)}%`, background: solidGradient(colorOf(row, index), 90) }} /></div>
          </div>)}</div>
        </div>
      </section>
      <section className={panel}>
        <PanelHeader eyebrow="Ranking" title="Conversão por canal" subtitle="Compare volume e qualidade de cada plataforma." />
        <Ranking analysis={channel} money={money} firstColumn="Canal" />
      </section>
    </div>

    {/* Campanhas e criativos */}
    <SectionTitle id="rastreio-campanhas" eyebrow="Campanhas e criativos" heading="Quais campanhas e peças trazem negócio" detail="Campanha pela utm_campaign ou pela campanha do Meta Lead Ads; criativo pela utm_content ou pelo nome do anúncio." />
    <section className={panel}>
      <PanelHeader eyebrow="Campanhas" title="Conversão por campanha" subtitle={`${nf(campaign.total)} leads com campanha identificada`} icon={<Megaphone size={18} />} />
      <Ranking analysis={campaign} money={money} firstColumn="Campanha" unitShare="dos leads com campanha" limit={6} />
    </section>
    <div className="grid gap-5 xl:grid-cols-2">
      <section className={panel}>
        <PanelHeader eyebrow="Criativos" title="Conversão por criativo / anúncio" subtitle={`${nf(creative.total)} leads com criativo identificado`} />
        <Ranking analysis={creative} money={money} firstColumn="Criativo" unitShare="dos leads com criativo" limit={6} />
      </section>
      <section className={panel}>
        <PanelHeader eyebrow="Formulários" title="Conversão por formulário" subtitle={`${nf(form.total)} leads vindos de formulário`} />
        <Ranking analysis={form} money={money} firstColumn="Formulário" unitShare="dos leads de formulário" limit={6} />
      </section>
    </div>

    {/* Dispositivos */}
    <SectionTitle id="rastreio-dispositivos" eyebrow="Dispositivos e navegadores" heading="Em que aparelho o lead preencheu" detail={`Disponível para leads de formulários e do site (${nf(withSession)} no período).`} />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]">
      <section className={panel}>
        <PanelHeader eyebrow="Distribuição" title="Leads por dispositivo" icon={<Smartphone size={18} />} />
        <Donut rows={donutRows(device)} unit="leads" iconFor={deviceIcon} />
      </section>
      <section className={panel}>
        <PanelHeader eyebrow="Ranking" title="Conversão por dispositivo" />
        <Ranking analysis={device} money={money} firstColumn="Aparelho" iconFor={deviceIcon} unitShare="dos leads rastreados" />
      </section>
    </div>
    <div className="grid gap-5 xl:grid-cols-2">
      <section className={panel}>
        <PanelHeader eyebrow="Navegadores" title="Conversão por navegador" subtitle="“Instagram” e “Facebook” são os navegadores internos dos apps." />
        <Ranking analysis={browser} money={money} firstColumn="Navegador" unitShare="dos leads rastreados" limit={6} />
      </section>
      <section className={panel}>
        <PanelHeader eyebrow="Sistemas" title="Conversão por sistema operacional" />
        <Ranking analysis={os} money={money} firstColumn="Sistema" unitShare="dos leads rastreados" limit={6} />
      </section>
    </div>
  </div>;
}
