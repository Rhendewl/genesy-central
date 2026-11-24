"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownRight, ArrowUpRight, Ban, Check, Clock3, Copy, ExternalLink, Eye, Globe2, Image as ImageIcon, Monitor, MousePointerClick, Pencil, Plus, Power, Radio,
  RefreshCw, Server, Settings2, Smartphone, Tablet, Trash2, TrendingUp, Upload, UserRound, Users, X,
} from "lucide-react";
import { toast } from "sonner";

/* ─────────────────────────── Tipos ─────────────────────────── */

type Row = { name: string; value: number };
type Lead = { id: string; name: string; phone: string; email?: string | null; profile: string | null; monthly_vgv: string | null; sync_status: string; sync_error: string | null; crm_lead_id: string | null; created_at: string };
type Overview = {
  summary: { sessions: number; visitors: number; views: number; avg_seconds: number; leads: number; conversion_rate: number };
  previous?: { sessions: number; leads: number };
  timeline: Array<{ date: string; sessions: number; views: number; leads: number }>;
  sections: Row[];
  sources?: Row[];
  campaigns?: Row[];
  devices?: Row[];
  clicks?: Row[];
  funnel?: Row[];
  whatsapp_clicks?: number;
  pixel?: PixelOverview;
  leads: Lead[];
};
type PixelOverview = {
  enabled: boolean; pixel_id: string | null; capi: boolean; last_event_at: string | null;
  last_error: { message: string | null; at: string } | null;
  totals: Array<{ event: string; browser_sent: number; browser_blocked: number; server_sent: number; server_failed: number }>;
};
type SiteTab = { site_key: string; name: string; domain: string; is_active?: boolean };
type PixelSettings = { meta_pixel_enabled?: boolean | null; meta_pixel_id?: string | null; meta_test_event_code?: string | null; has_capi_token?: boolean };
type Pipeline = { id: string; name: string; crm_stages: Array<{ id: string; name: string; order_index: number; is_active: boolean }> };
type SettingsPayload = { settings: ({ crm_pipeline_id: string | null; crm_stage_id: string | null; deal_value?: number | string | null; og_image_url?: string | null } & PixelSettings) | null; pipelines: Pipeline[]; canManage: boolean };

/* ─────────────────────────── Utilitários ─────────────────────────── */

const META_BLUE = "#0866FF";
/** Pares [claro, forte] de cada cor: funcionam nos temas claro e escuro. */
const GRADIENTS: Array<[string, string]> = [["#6ee7b7", "#10b981"], ["#7dd3fc", "#0284c7"], ["#c4b5fd", "#7c3aed"], ["#fcd34d", "#d97706"], ["#fda4af", "#e11d48"], ["#5eead4", "#0d9488"], ["#f9a8d4", "#db2777"], ["#cbd5e1", "#64748b"]];
const gradient = (index: number, angle = 90) => { const [light, strong] = GRADIENTS[index % GRADIENTS.length]; return `linear-gradient(${angle}deg, ${strong}, ${light})`; };
const BTN_GREEN = "linear-gradient(135deg, #059669, #10b981 55%, #34d399)";
const BTN_BLUE = "linear-gradient(135deg, #0866FF, #3b8bff)";
const PIXEL_LABELS: Record<string, { name: string; detail: string }> = {
  PageView: { name: "Visita", detail: "PageView · abriu a página" },
  ViewContent: { name: "Viu o formulário", detail: "ViewContent · chegou ao formulário" },
  Contact: { name: "Contato", detail: "Contact · clicou no WhatsApp" },
  Lead: { name: "Lead", detail: "Lead · enviou o formulário" },
};
const LABELS: Record<string, string> = { direto: "Direto", instagram: "Instagram", ig: "Instagram", facebook: "Facebook", meta: "Facebook / Instagram", google: "Google", google_ads: "Google Ads", tiktok_ads: "TikTok Ads", bing_ads: "Bing Ads", whatsapp: "WhatsApp", youtube: "YouTube", linkedin: "LinkedIn", tiktok: "TikTok", x: "X (Twitter)", bing: "Bing", mobile: "Celular", desktop: "Computador", tablet: "Tablet", desconhecido: "Não identificado", top: "Topo", oferta: "Oferta (topo)", numeros: "Números", depoimentos: "Depoimentos", sistema: "Sistema Genesy", faq: "FAQ", cta: "Formulário" };
const label = (name: string) => LABELS[name] ?? name;
const nf = (value: number) => value.toLocaleString("pt-BR");
const pct = (value: number, total: number) => (total ? (value / total) * 100 : 0);
const pctText = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: value < 10 ? 1 : 0 })}%`;
const duration = (seconds: number) => (seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}min ${seconds % 60}s`);
const dateLabel = (iso: string) => iso.slice(5).split("-").reverse().join("/");
const niceMax = (value: number) => {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find(s => s * magnitude * 4 >= value) ?? 10;
  return step * magnitude * 4;
};
const muted = { color: "var(--text-body)" } as const;
const title = { color: "var(--text-title)" } as const;
const fieldCls = "lc-form-control h-12 w-full rounded-xl px-4 text-sm";

/* ─────────────────────────── Peças visuais ─────────────────────────── */

function Card({ heading, subtitle, icon, action, className = "", children }: { heading: string; subtitle?: string; icon?: React.ReactNode; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return <section className={`lc-card min-w-0 p-5 ${className}`}>
    <header className="mb-4 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {icon && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">{icon}</span>}
        <div className="min-w-0"><h2 className="text-sm font-semibold" style={title}>{heading}</h2>{subtitle && <p className="mt-0.5 text-xs" style={muted}>{subtitle}</p>}</div>
      </div>
      {action}
    </header>
    {children}
  </section>;
}

function Field({ text, extra, children }: { text: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 flex items-center gap-2 text-xs font-medium" style={{ color: "var(--text-subtitle)" }}>{text}{extra}</span>{children}</label>;
}

function Switch({ checked, onChange, disabled, color = META_BLUE }: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean; color?: string }) {
  return <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
    className="relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50" style={{ background: checked ? `linear-gradient(135deg, ${color}, #5aa2ff)` : "var(--border-card-hover)" }}>
    <span className="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ left: checked ? 24 : 4 }} />
  </button>;
}

/** Brilho de fundo recortado pelo contorno arredondado do card (sem quinas aparecendo). */
function Glow({ spots }: { spots: Array<{ color: string; className: string; opacity: number }> }) {
  return <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={{ borderRadius: "inherit", clipPath: "inset(0 round 20px)" }}>
    {spots.map((spot, index) => <div key={index} className={`absolute rounded-full ${spot.className}`} style={{ background: `radial-gradient(circle, ${spot.color} 0%, transparent 68%)`, opacity: spot.opacity }} />)}
  </div>;
}

function Empty({ text }: { text: string }) {
  return <p className="grid min-h-[120px] place-items-center rounded-xl border border-dashed px-4 text-center text-xs" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>{text}</p>;
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2 || !values.some(Boolean)) return <div className="h-10" />;
  const max = Math.max(...values, 1);
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${38 - (value / max) * 32}`);
  const id = `spark-${color.replace("#", "")}`;
  return <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-10 w-full" aria-hidden>
    <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.35} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
    <polygon points={`0,40 ${points.join(" ")} 100,40`} fill={`url(#${id})`} />
    <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
  </svg>;
}

function Delta({ current, previous, points }: { current: number; previous?: number; points?: boolean }) {
  if (previous === undefined) return null;
  if (!previous && !current) return <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>sem dados antes</span>;
  if (!previous) return <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">novo</span>;
  const diff = points ? current - previous : ((current - previous) / previous) * 100;
  const up = diff >= 0;
  const text = points ? `${up ? "+" : ""}${diff.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.` : `${up ? "+" : ""}${pctText(diff)}`;
  return <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${up ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
    {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{text}
  </span>;
}

function Kpi({ icon, name, value, detail, delta, spark, color = "#34d399" }: { icon: React.ReactNode; name: string; value: string; detail: string; delta?: React.ReactNode; spark?: number[]; color?: string }) {
  return <div className="lc-card relative flex min-h-[150px] min-w-0 flex-col overflow-hidden p-3.5 sm:p-4">
    <div className="flex items-center justify-between gap-2"><p className="text-xs font-medium" style={{ color: "var(--text-subtitle)" }}>{name}</p><span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `${color}1f`, color }}>{icon}</span></div>
    <strong className="mt-2 block text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl" style={title}>{value}</strong>
    <div className="mt-1 flex flex-wrap items-center gap-2"><span className="text-[11px]" style={muted}>{detail}</span>{delta}</div>
    {spark && <div className="mt-auto -mx-1 pt-2"><Sparkline values={spark} color={color} /></div>}
  </div>;
}

/** Gráfico de barras (acessos/visualizações) + linha (leads), com legenda clicável e detalhe ao passar o mouse. */
function TimelineChart({ rows }: { rows: Overview["timeline"] }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [show, setShow] = useState({ sessions: true, views: false, leads: true });
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const H = 260, padL = 36, padR = show.leads ? 32 : 12, padT = 14, padB = 28;
  const innerW = width - padL - padR, innerH = H - padT - padB;
  const step = innerW / Math.max(1, rows.length);
  const barMax = niceMax(Math.max(1, ...rows.map(row => Math.max(show.sessions ? row.sessions : 0, show.views ? row.views : 0))));
  const leadMax = niceMax(Math.max(1, ...rows.map(row => row.leads)));
  const y = (value: number, max: number) => padT + innerH - (value / max) * innerH;
  const bars = [show.sessions && { key: "sessions" as const, color: "#34d399" }, show.views && { key: "views" as const, color: "#38bdf8" }].filter(Boolean) as Array<{ key: "sessions" | "views"; color: string }>;
  const barW = Math.max(1.5, (step * 0.66) / Math.max(1, bars.length));
  const every = Math.ceil(rows.length / Math.max(2, Math.floor(innerW / 64)));
  const leadPoints = rows.map((row, index) => `${padL + index * step + step / 2},${y(row.leads, leadMax)}`).join(" ");
  const series = [
    { key: "sessions" as const, name: "Acessos", color: "#34d399", fill: gradient(0, 135), total: rows.reduce((sum, row) => sum + row.sessions, 0) },
    { key: "views" as const, name: "Visualizações", color: "#38bdf8", fill: gradient(1, 135), total: rows.reduce((sum, row) => sum + row.views, 0) },
    { key: "leads" as const, name: "Leads", color: "#fbbf24", fill: gradient(3, 135), total: rows.reduce((sum, row) => sum + row.leads, 0) },
  ];
  const active = hover !== null ? rows[hover] : null;
  return <div>
    <div className="mb-4 flex flex-wrap gap-2">
      {series.map(item => <button key={item.key} type="button" aria-pressed={show[item.key]} onClick={() => setShow(current => ({ ...current, [item.key]: !current[item.key] }))}
        className="flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition hover:bg-white/5" style={{ borderColor: show[item.key] ? `${item.color}66` : "var(--border)", opacity: show[item.key] ? 1 : 0.55 }}>
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.fill }} />
        <span><span className="block text-[11px]" style={muted}>{item.name}</span><strong className="block text-base tabular-nums leading-tight" style={title}>{nf(item.total)}</strong></span>
      </button>)}
    </div>
    <div ref={box} className="relative w-full min-w-0 overflow-hidden" style={{ height: H }} onMouseLeave={() => setHover(null)}>
      {width > 0 && <svg width={width} height={H} className="block" role="img" aria-label="Acessos e leads por dia"
        onMouseMove={event => { const x = event.clientX - event.currentTarget.getBoundingClientRect().left - padL; setHover(Math.min(rows.length - 1, Math.max(0, Math.floor(x / step)))); }}>
        <defs>{bars.map(bar => <linearGradient key={bar.key} id={`bar-${bar.key}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={bar.color} stopOpacity={0.95} /><stop offset="100%" stopColor={bar.color} stopOpacity={0.35} /></linearGradient>)}</defs>
        {[0, 0.25, 0.5, 0.75, 1].map(f => <g key={f}>
          <line x1={padL} x2={width - padR} y1={padT + innerH * (1 - f)} y2={padT + innerH * (1 - f)} stroke="var(--chart-grid)" />
          {bars.length > 0 && <text x={padL - 8} y={padT + innerH * (1 - f) + 4} textAnchor="end" fontSize={10} fill="var(--text-muted)">{nf(Math.round(barMax * f))}</text>}
          {show.leads && <text x={width - padR + 8} y={padT + innerH * (1 - f) + 4} fontSize={10} fill="#fbbf24" opacity={0.8}>{nf(Math.round(leadMax * f))}</text>}
        </g>)}
        {hover !== null && <rect x={padL + hover * step} y={padT} width={step} height={innerH} fill="var(--hover)" rx={4} />}
        {rows.map((row, index) => bars.map((bar, b) => {
          const value = row[bar.key];
          const top = y(value, barMax);
          return <rect key={`${row.date}-${bar.key}`} x={padL + index * step + (step - barW * bars.length) / 2 + b * barW} y={top} width={Math.max(1, barW - 1)} height={Math.max(0, padT + innerH - top)} rx={Math.min(4, barW / 2)} fill={`url(#bar-${bar.key})`} opacity={hover === null || hover === index ? 1 : 0.55} />;
        }))}
        {show.leads && <>
          <polyline points={leadPoints} fill="none" stroke="#fbbf24" strokeWidth={2} strokeLinejoin="round" />
          {rows.map((row, index) => row.leads > 0 && <circle key={row.date} cx={padL + index * step + step / 2} cy={y(row.leads, leadMax)} r={hover === index ? 5 : 3.5} fill="#fbbf24" stroke="var(--background)" strokeWidth={2} />)}
        </>}
        {rows.map((row, index) => index % every === 0 && <text key={row.date} x={padL + index * step + step / 2} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--text-muted)">{dateLabel(row.date)}</text>)}
      </svg>}
      {active && hover !== null && <div className="pointer-events-none absolute top-2 z-10 min-w-[150px] rounded-xl border px-3 py-2 text-xs shadow-xl backdrop-blur-md"
        style={{ left: Math.min(width - 160, Math.max(0, padL + hover * step + step / 2 - 75)), background: "var(--chart-tooltip-bg)", borderColor: "var(--chart-tooltip-border)", color: "var(--chart-tooltip-text)" }}>
        <p className="mb-1 font-semibold">{new Date(`${active.date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}</p>
        {series.map(item => <p key={item.key} className="flex items-center justify-between gap-4"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: item.color }} />{item.name}</span><strong className="tabular-nums">{nf(active[item.key])}</strong></p>)}
      </div>}
    </div>
  </div>;
}

/** Funil em degraus: cada etapa mostra o total, a fatia do topo e quanto passou da etapa anterior. */
function Funnel({ steps }: { steps: Row[] }) {
  const first = steps[0]?.value ?? 0;
  if (!first) return <Empty text="Sem acessos no período." />;
  return <div className="space-y-1.5">
    {steps.map((step, index) => {
      const share = pct(step.value, first);
      const fromPrev = index ? pct(step.value, steps[index - 1].value) : 100;
      return <div key={step.name}>
        {index > 0 && <p className="flex items-center justify-center gap-1 py-0.5 text-[11px]" style={muted}><ArrowDownRight size={12} className="rotate-45" />{pctText(fromPrev)} avançaram</p>}
        <div className="relative h-12 overflow-hidden rounded-xl" style={{ background: "var(--hover)" }}>
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 rounded-xl transition-all duration-700" style={{ width: `${Math.max(share, 6)}%`, background: "linear-gradient(90deg, rgba(16,185,129,.75), rgba(110,231,183,.95) 50%, rgba(16,185,129,.75))", opacity: 1 - index * 0.08, boxShadow: "0 6px 24px rgba(16,185,129,.25)" }} />
          <div className="relative flex h-full items-center justify-between px-3 text-xs"><span className="font-medium" style={{ color: "var(--text-subtitle)" }}>{step.name}</span><span className="flex items-baseline gap-2"><strong className="text-base tabular-nums" style={title}>{nf(step.value)}</strong><span className="w-10 text-right tabular-nums" style={muted}>{pctText(share)}</span></span></div>
        </div>
      </div>;
    })}
  </div>;
}

/** Rosca com gradiente em cada fatia e legenda ao lado (à esquerda ou à direita). */
function Donut({ rows, unit, iconFor, legendFirst = false, limit = 6 }: { rows: Row[]; unit: string; iconFor?: (name: string) => React.ReactNode; legendFirst?: boolean; limit?: number }) {
  const uid = useId().replace(/:/g, "");
  const sorted = [...rows].sort((x, y) => y.value - x.value);
  const list = sorted.length > limit ? [...sorted.slice(0, limit - 1), { name: "Outros", value: sorted.slice(limit - 1).reduce((sum, row) => sum + row.value, 0) }] : sorted;
  const total = list.reduce((sum, row) => sum + row.value, 0);
  if (!total) return <Empty text={`Nenhum registro de ${unit} no período.`} />;
  const radius = 44, circumference = 2 * Math.PI * radius;
  let offset = 0;
  const chart = <div className="relative h-36 w-36 shrink-0">
    <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
      <defs>{list.map((row, index) => <linearGradient key={row.name} id={`${uid}-${index}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="120" y2="120"><stop offset="0%" stopColor={GRADIENTS[index % GRADIENTS.length][0]} /><stop offset="100%" stopColor={GRADIENTS[index % GRADIENTS.length][1]} /></linearGradient>)}</defs>
      <circle cx={60} cy={60} r={radius} fill="none" stroke="var(--hover)" strokeWidth={14} />
      {list.map((row, index) => {
        const length = (row.value / total) * circumference;
        const segment = <circle key={row.name} cx={60} cy={60} r={radius} fill="none" stroke={`url(#${uid}-${index})`} strokeWidth={14} strokeDasharray={`${Math.max(0.01, length - (list.length > 1 ? 2.5 : 0))} ${circumference}`} strokeDashoffset={-offset} strokeLinecap={list.length > 1 ? "round" : "butt"} />;
        offset += length;
        return segment;
      })}
    </svg>
    <div className="absolute inset-0 grid place-items-center text-center"><div><strong className="block text-2xl tabular-nums" style={title}>{nf(total)}</strong><span className="text-[11px]" style={muted}>{unit}</span></div></div>
  </div>;
  const legend = <ul className="min-w-[185px] flex-1 space-y-2.5">
    {list.map((row, index) => <li key={row.name} className="flex items-center justify-between gap-3 text-xs">
      <span className="flex min-w-0 items-center gap-2" style={{ color: "var(--text-subtitle)" }}>
        {iconFor ? <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-white" style={{ background: gradient(index, 135) }}>{iconFor(row.name)}</span> : <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: gradient(index, 135) }} />}
        <span className="leading-snug [overflow-wrap:break-word]">{label(row.name)}</span>
      </span>
      <span className="shrink-0 tabular-nums"><strong style={title}>{pctText(pct(row.value, total))}</strong> <span style={muted}>· {nf(row.value)}</span></span>
    </li>)}
  </ul>;
  return <div className="flex flex-wrap items-center gap-5">{legendFirst ? <>{legend}{chart}</> : <>{chart}{legend}</>}</div>;
}

const deviceIcon = (name: string) => name === "mobile" ? <Smartphone size={13} /> : name === "tablet" ? <Tablet size={13} /> : <Monitor size={13} />;

/** Lista com barra, valor e porcentagem (sobre o total ou sobre uma base informada). */
function ShareList({ rows, base, empty, colored = true, limit = 6 }: { rows?: Row[]; base?: number; empty: string; colored?: boolean; limit?: number }) {
  const list = (rows ?? []).slice(0, limit);
  if (!list.length) return <Empty text={empty} />;
  const total = base ?? list.reduce((sum, row) => sum + row.value, 0);
  return <ul className="space-y-3">
    {list.map((row, index) => {
      const fill = colored ? gradient(index) : gradient(0);
      const share = pct(row.value, total);
      return <li key={row.name}>
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="flex min-w-0 items-center gap-2" style={{ color: "var(--text-subtitle)" }}><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: fill }} /><span className="truncate">{label(row.name)}</span></span>
          <span className="shrink-0 tabular-nums"><strong className="text-sm" style={title}>{nf(row.value)}</strong> <span className="inline-block w-12 text-right" style={muted}>{pctText(share)}</span></span>
        </div>
        <div className="mt-1.5 h-2 rounded-full" style={{ background: "var(--hover)" }}><div className="h-2 rounded-full transition-all duration-700" style={{ width: `${Math.max(2, Math.min(100, share))}%`, background: fill }} /></div>
      </li>;
    })}
  </ul>;
}

/* ─────────────────────────── Pixel do Meta ─────────────────────────── */

function PixelPanel({ site, pixel, settings, canManage, onSaved }: { site: string; pixel?: PixelOverview; settings: PixelSettings | null; canManage: boolean; onSaved: () => Promise<void> }) {
  const [enabled, setEnabled] = useState(Boolean(settings?.meta_pixel_enabled));
  const [pixelId, setPixelId] = useState(settings?.meta_pixel_id ?? "");
  const [token, setToken] = useState("");
  const [testCode, setTestCode] = useState(settings?.meta_test_event_code ?? "");
  const [removeToken, setRemoveToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const hasToken = Boolean(settings?.has_capi_token) && !removeToken;
  async function save() {
    setSaving(true);
    const response = await fetch(`/api/site-analytics/pixel?site=${encodeURIComponent(site)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled, pixel_id: pixelId, capi_token: token || null, remove_capi_token: removeToken, test_event_code: testCode || null }) });
    const json = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) return toast.error(json.error ?? "Não foi possível salvar o Pixel");
    setToken(""); setRemoveToken(false);
    toast.success(json.pixel_name ? `Pixel "${json.pixel_name}" conectado` : enabled ? "Pixel ativado nesta página" : "Pixel salvo (desativado)");
    await onSaved();
  }
  const totals = pixel?.totals ?? [];
  const sum = (key: "browser_sent" | "browser_blocked" | "server_sent") => totals.reduce((total, row) => total + row[key], 0);
  const status = !pixel?.enabled ? { text: "Desativado", dot: "#9ca3af" } : pixel.last_event_at ? { text: "Ativo e enviando eventos", dot: "#34d399" } : { text: "Ativo · aguardando o primeiro acesso", dot: "#fbbf24" };
  const stats = [
    { name: "Pelo navegador", value: sum("browser_sent"), icon: <Globe2 size={15} />, hint: "Disparados pelo Pixel no navegador" },
    { name: "Pelo servidor", value: pixel?.capi ? sum("server_sent") : null, icon: <Server size={15} />, hint: pixel?.capi ? "Enviados pela API de Conversões" : "Configure o token para ativar" },
    { name: "Bloqueados", value: sum("browser_blocked"), icon: <Ban size={15} />, hint: "Navegador com bloqueador de anúncios" },
  ];
  return <section className="lc-card relative overflow-hidden p-5 sm:p-6">
    <Glow spots={[{ color: META_BLUE, className: "-left-48 -top-56 h-[36rem] w-[36rem]", opacity: 0.32 }, { color: "#3b8bff", className: "-bottom-64 -right-32 h-[34rem] w-[40rem]", opacity: 0.16 }]} />
    <div className="relative">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${META_BLUE}, #3b8bff)`, boxShadow: `0 10px 30px ${META_BLUE}55` }}><Radio size={19} /></span>
          <div><h2 className="text-base font-semibold" style={title}>Pixel do Meta</h2><p className="mt-0.5 text-xs" style={muted}>Eventos desta página enviados ao Facebook e Instagram para medir e otimizar os anúncios.</p></div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: "var(--border-card-hover)", color: "var(--text-title)", background: "var(--hover)" }}>
          <span className="relative flex h-2 w-2">{pixel?.enabled && pixel.last_event_at && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: status.dot }} />}<span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: status.dot }} /></span>{status.text}
        </span>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)]">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5" style={{ borderColor: "var(--border-card-hover)", background: "var(--hover)" }}>
            <div><p className="text-sm font-semibold" style={title}>Pixel ativo nesta página</p><p className="text-xs" style={muted}>Liga ou desliga sem publicar a página de novo</p></div>
            <Switch checked={enabled} onChange={setEnabled} disabled={!canManage} />
          </div>
          <Field text="ID do Pixel"><input value={pixelId} onChange={e => setPixelId(e.target.value.replace(/\D/g, ""))} disabled={!canManage} inputMode="numeric" placeholder="Ex.: 123456789012345" className={`${fieldCls} tabular-nums tracking-wide`} /></Field>
          <Field text="Token da API de Conversões" extra={hasToken ? <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">salvo</span> : null}>
            <input type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} disabled={!canManage} placeholder={hasToken ? "•••••••• deixe vazio para manter" : "Cole o token do Gerenciador de Eventos"} className={fieldCls} />
          </Field>
          {settings?.has_capi_token && canManage && <label className="flex items-center gap-2 text-xs" style={muted}><input type="checkbox" checked={removeToken} onChange={e => setRemoveToken(e.target.checked)} className="h-4 w-4 accent-rose-500" /> Remover o token salvo</label>}
          <Field text="Código de teste" extra={<span className="text-[10px] font-normal" style={{ color: "var(--text-muted)" }}>opcional · só durante testes</span>}>
            <input value={testCode} onChange={e => setTestCode(e.target.value)} disabled={!canManage} placeholder="Ex.: TEST12345" className={fieldCls} />
          </Field>
          {canManage && <button onClick={() => void save()} disabled={saving || (enabled && !pixelId)} className="h-12 w-full rounded-xl text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50" style={{ background: BTN_BLUE, boxShadow: `0 12px 30px ${META_BLUE}44` }}>{saving ? "Salvando…" : "Salvar Pixel"}</button>}
          <p className="text-[11px] leading-relaxed" style={muted}>O ID e o token ficam no Gerenciador de Eventos → seu Pixel → Configurações. O token é guardado criptografado e não aparece de novo.</p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {stats.map(stat => <div key={stat.name} className="min-w-0 rounded-2xl border p-3 sm:p-4" style={{ borderColor: "var(--border-card-hover)", background: "var(--hover)" }}>
              <p className="flex items-center gap-1.5 text-[11px] font-medium sm:text-xs" style={{ color: "var(--text-subtitle)" }}><span className="hidden sm:inline" style={{ color: META_BLUE }}>{stat.icon}</span>{stat.name}</p>
              <strong className="mt-2 block text-2xl font-semibold tabular-nums tracking-tight sm:text-4xl" style={title}>{stat.value === null ? "—" : nf(stat.value)}</strong>
              <p className="mt-1 hidden text-[11px] sm:block" style={muted}>{stat.hint}</p>
            </div>)}
          </div>
          <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border-card-hover)" }}>
            <div className="grid grid-cols-[minmax(0,1fr)_52px_52px_60px] sm:grid-cols-[minmax(0,1fr)_80px_80px_80px] gap-2 px-3 py-2.5 text-[11px] font-semibold sm:px-4" style={{ color: "var(--text-subtitle)", background: "var(--hover)" }}><span>Evento</span><span className="text-right">Naveg.</span><span className="text-right">Servidor</span><span className="text-right">Bloq.</span></div>
            {totals.map(row => <div key={row.event} className="grid grid-cols-[minmax(0,1fr)_52px_52px_60px] items-center gap-2 border-t px-3 py-3 sm:grid-cols-[minmax(0,1fr)_80px_80px_80px] sm:px-4" style={{ borderColor: "var(--border)" }}>
              <div className="min-w-0"><p className="text-sm font-semibold" style={title}>{PIXEL_LABELS[row.event]?.name ?? row.event}</p><p className="truncate text-[11px]" style={muted}>{PIXEL_LABELS[row.event]?.detail}</p></div>
              <strong className="text-right text-lg tabular-nums sm:text-xl" style={title}>{nf(row.browser_sent)}</strong>
              <strong className="text-right text-lg tabular-nums sm:text-xl" style={title}>{pixel?.capi ? nf(row.server_sent) : "—"}{row.server_failed ? <span className="block text-[10px] font-semibold text-rose-400">{row.server_failed} falhas</span> : null}</strong>
              <strong className="text-right text-lg tabular-nums sm:text-xl" style={{ color: row.browser_blocked ? "#fbbf24" : "var(--text-muted)" }}>{nf(row.browser_blocked)}</strong>
            </div>)}
          </div>
          <p className="text-[11px] leading-relaxed" style={muted}>“Bloqueados” são visitantes com bloqueador de anúncios: o navegador não envia, mas o servidor envia mesmo assim quando o token está configurado.{pixel?.last_event_at ? ` Último evento: ${new Date(pixel.last_event_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.` : ""}</p>
          {pixel?.last_error && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-400">Última falha no envio pelo servidor ({new Date(pixel.last_error.at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}): {pixel.last_error.message}</p>}
        </div>
      </div>
    </div>
  </section>;
}

/* ─────────────────────────── Nova página ─────────────────────────── */

const slugify = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);

function NewPageForm({ onCreated, onCancel }: { onCreated: (siteKey: string) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyEdited, setKeyEdited] = useState(false);
  const [domain, setDomain] = useState("genesycompany.com/");
  const [saving, setSaving] = useState(false);
  async function create() {
    setSaving(true);
    const response = await fetch("/api/site-analytics/sites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, site_key: key, domain }) });
    const json = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) return toast.error(json.error ?? "Não foi possível criar a página");
    toast.success("Página criada");
    await onCreated(json.site_key);
  }
  return <Card heading="Nova página" subtitle="Começa com a mesma pipeline e o mesmo Pixel do Site Genesy; dá para trocar depois na aba da página." icon={<Plus size={16} />}
    action={<button onClick={onCancel} aria-label="Cancelar" className="grid h-9 w-9 place-items-center rounded-xl transition hover:bg-white/5" style={muted}><X size={16} /></button>}>
    <div className="grid gap-4 md:grid-cols-3">
      <Field text="Nome"><input value={name} onChange={e => { setName(e.target.value); if (!keyEdited) setKey(slugify(e.target.value)); }} placeholder="Ex.: Scripts Imobiliários" className={fieldCls} /></Field>
      <Field text="Identificador (usado no código da página)"><input value={key} onChange={e => { setKeyEdited(true); setKey(slugify(e.target.value)); }} placeholder="ex.: scripts-imobiliarios" className={fieldCls} /></Field>
      <Field text="Endereço"><input value={domain} onChange={e => setDomain(e.target.value)} placeholder="genesycompany.com/pagina" className={fieldCls} /></Field>
    </div>
    {key && <p className="mt-3 text-xs" style={muted}>A página envia os dados para <code>https://dash.genesycompany.com/api/site/{key}</code>.</p>}
    <button onClick={() => void create()} disabled={saving || name.trim().length < 2 || key.length < 2 || !domain.trim()} className="mt-4 h-12 rounded-xl px-6 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50" style={{ background: BTN_GREEN, boxShadow: "0 12px 30px rgba(16,185,129,.25)" }}>{saving ? "Criando…" : "Criar página"}</button>
  </Card>;
}

/* ─────────────────────────── Confirmação ─────────────────────────── */

function ConfirmDialog({ icon, heading, children, confirmText, busyText, busy, tone = "rose", onCancel, onConfirm }: { icon: React.ReactNode; heading: string; children: React.ReactNode; confirmText: string; busyText: string; busy: boolean; tone?: "rose" | "amber"; onCancel: () => void; onConfirm: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  const colors = tone === "rose" ? { chip: "bg-rose-500/10 text-rose-400", button: "linear-gradient(135deg, #e11d48, #fb7185)" } : { chip: "bg-amber-500/10 text-amber-400", button: "linear-gradient(135deg, #d97706, #fbbf24)" };
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={onCancel}>
    <div className="w-full max-w-md rounded-2xl border bg-black/30 p-6 shadow-2xl backdrop-blur-2xl [.light_&]:bg-[rgba(248,248,248,0.9)]" style={{ borderColor: "var(--border-modal)" }} onClick={event => event.stopPropagation()}>
      <span className={`grid h-11 w-11 place-items-center rounded-2xl ${colors.chip}`}>{icon}</span>
      <h3 id="confirm-title" className="mt-4 text-base font-semibold" style={title}>{heading}</h3>
      <div className="mt-2 text-sm leading-relaxed" style={muted}>{children}</div>
      <div className="mt-6 flex gap-3">
        <button onClick={onCancel} className="h-11 flex-1 rounded-xl border text-sm font-semibold transition hover:bg-white/5" style={{ borderColor: "var(--border-card-hover)", color: "var(--text-title)" }}>Cancelar</button>
        <button onClick={onConfirm} disabled={busy} autoFocus className="h-11 flex-1 rounded-xl text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60" style={{ background: colors.button }}>{busy ? busyText : confirmText}</button>
      </div>
    </div>
  </div>;
}

/* ─────────────────────────── Banner do link ─────────────────────────── */

const DEFAULT_OG_IMAGE = "https://genesycompany.com/og.png";
const OG_WIDTH = 1200, OG_HEIGHT = 630;

/** Recorta (cobrindo) para 1200×630 e comprime em JPEG: tamanho que WhatsApp e Instagram exibem bem. */
async function toBanner(file: File, focusY: number): Promise<Blob> {
  const source = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => { const element = new Image(); element.onload = () => resolve(element); element.onerror = () => reject(new Error("Imagem inválida")); element.src = source; });
    const canvas = document.createElement("canvas");
    canvas.width = OG_WIDTH; canvas.height = OG_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Navegador sem suporte a imagens");
    const scale = Math.max(OG_WIDTH / image.naturalWidth, OG_HEIGHT / image.naturalHeight);
    const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
    context.fillStyle = "#000"; context.fillRect(0, 0, OG_WIDTH, OG_HEIGHT);
    context.drawImage(image, (OG_WIDTH - width) / 2, (OG_HEIGHT - height) * focusY, width, height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Falha ao preparar a imagem")), "image/jpeg", 0.86));
  } finally {
    URL.revokeObjectURL(source);
  }
}

function OgImageDialog({ site, name, domain, current, onClose, onSaved }: { site: string; name: string; domain: string; current: string | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [focusY, setFocusY] = useState(0.5);
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    if (!file) return;
    let url: string | null = null, cancelled = false;
    toBanner(file, focusY).then(result => { if (cancelled) return; url = URL.createObjectURL(result); setBlob(result); setPreview(url); }).catch(error => toast.error(error instanceof Error ? error.message : "Imagem inválida"));
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [file, focusY]);
  function pick(list: FileList | null) {
    const chosen = list?.[0];
    if (!chosen) return;
    if (!/^image\/(jpeg|png|webp)$/.test(chosen.type)) return toast.error("Use uma imagem JPG, PNG ou WebP");
    if (chosen.size > 15 * 1024 * 1024) return toast.error("Imagem muito grande (máximo 15 MB)");
    setFocusY(0.5); setFile(chosen);
  }
  async function save() {
    if (!blob) return;
    setBusy(true);
    const form = new FormData();
    form.append("file", blob, "banner.jpg");
    const response = await fetch(`/api/site-analytics/og-image?site=${encodeURIComponent(site)}`, { method: "POST", body: form });
    const json = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return toast.error(json.error ?? "Não foi possível salvar o banner");
    toast.success("Banner do link atualizado");
    await onSaved(); onClose();
  }
  async function reset() {
    setBusy(true);
    const response = await fetch(`/api/site-analytics/og-image?site=${encodeURIComponent(site)}`, { method: "DELETE" });
    const json = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return toast.error(json.error ?? "Não foi possível restaurar");
    toast.success("Banner padrão restaurado");
    await onSaved(); onClose();
  }
  const shown = preview ?? current ?? DEFAULT_OG_IMAGE;
  const url = `https://${domain.replace(/^https?:\/\//, "")}`;
  return <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="og-title" onClick={onClose}>
    <div className="my-auto w-full max-w-xl rounded-2xl border bg-black/30 p-5 shadow-2xl backdrop-blur-2xl sm:p-6 [.light_&]:bg-[rgba(248,248,248,0.9)]" style={{ borderColor: "var(--border-modal)" }} onClick={event => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white" style={{ background: BTN_GREEN }}><ImageIcon size={18} /></span>
          <div><h3 id="og-title" className="text-base font-semibold" style={title}>Banner do link</h3><p className="mt-0.5 text-xs" style={muted}>Imagem que aparece quando o link {name ? `de ${name} ` : ""}é enviado no WhatsApp, Instagram ou Facebook.</p></div>
        </div>
        <button onClick={onClose} aria-label="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl transition hover:bg-white/5" style={muted}><X size={16} /></button>
      </div>

      <p className="mb-2 mt-5 text-[11px] font-medium" style={{ color: "var(--text-subtitle)" }}>Como o link vai aparecer</p>
      <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border-card-hover)", background: "var(--hover)" }}>
        <div className="relative aspect-[1200/630] w-full bg-black/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shown} alt="Banner do link" className="h-full w-full object-cover" />
          {preview && <span className="absolute left-2 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">Novo</span>}
          {!preview && !current && <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">Padrão do site</span>}
        </div>
        <div className="px-3 py-2.5"><p className="truncate text-sm font-semibold" style={title}>{name}</p><p className="truncate text-xs" style={muted}>{url.replace(/^https:\/\//, "")}</p></div>
      </div>

      <div className={`mt-4 grid place-items-center rounded-xl border border-dashed px-4 py-5 text-center transition ${dragging ? "bg-emerald-500/10" : ""}`} style={{ borderColor: dragging ? "#10b981" : "var(--border-card-hover)" }}
        onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); pick(event.dataTransfer.files); }}>
        <Upload size={18} style={muted} />
        <p className="mt-2 text-sm" style={{ color: "var(--text-subtitle)" }}>Arraste uma imagem aqui ou</p>
        <button type="button" onClick={() => input.current?.click()} className="mt-2 h-10 rounded-xl border px-4 text-xs font-semibold transition hover:bg-white/5" style={{ borderColor: "var(--border-card-hover)", color: "var(--text-title)" }}>Escolher imagem</button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={event => { pick(event.target.files); event.target.value = ""; }} />
        <p className="mt-2 text-[11px]" style={muted}>JPG, PNG ou WebP. Ideal 1200×630 px; outras medidas são ajustadas automaticamente.</p>
      </div>
      {file && <label className="mt-3 block text-xs" style={{ color: "var(--text-subtitle)" }}>Posição vertical do recorte
        <input type="range" min={0} max={1} step={0.01} value={focusY} onChange={event => setFocusY(Number(event.target.value))} className="mt-2 w-full accent-emerald-500" />
      </label>}

      <p className="mt-4 text-[11px] leading-relaxed" style={muted}>Conversas em que o link já foi enviado podem continuar mostrando a imagem antiga. Para o Facebook e o Instagram buscarem a nova na hora, use o <a href={`https://developers.facebook.com/tools/debug/?q=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" className="underline">Depurador de compartilhamento</a> e clique em “Coletar novamente”.</p>

      <div className="mt-5 flex flex-wrap gap-3">
        {current && <button onClick={() => void reset()} disabled={busy} className="h-11 rounded-xl border px-4 text-sm font-semibold transition hover:bg-white/5 disabled:opacity-60" style={{ borderColor: "var(--border-card-hover)", color: "var(--text-subtitle)" }}>Restaurar padrão</button>}
        <button onClick={onClose} className="h-11 flex-1 rounded-xl border text-sm font-semibold transition hover:bg-white/5" style={{ borderColor: "var(--border-card-hover)", color: "var(--text-title)" }}>Cancelar</button>
        <button onClick={() => void save()} disabled={!blob || busy} className="h-11 flex-1 rounded-xl text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50" style={{ background: BTN_GREEN }}>{busy ? "Salvando…" : "Salvar banner"}</button>
      </div>
    </div>
  </div>;
}

/* ─────────────────────────── Período (pílula deslizante) ─────────────────────────── */

const PERIODS = [{ days: 7, text: "7 dias" }, { days: 30, text: "30 dias" }, { days: 90, text: "90 dias" }];

function PeriodSwitch({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const element = buttons.current[PERIODS.findIndex(period => period.days === value)];
      if (element) setPill({ left: element.offsetLeft, width: element.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [value]);
  return <div className="relative flex h-11 shrink-0 items-center rounded-xl border p-1" style={{ borderColor: "var(--border-card-hover)", background: "var(--hover)" }} role="group" aria-label="Período">
    {pill && <span aria-hidden className="absolute bottom-1 top-1 rounded-lg transition-all duration-300 ease-out" style={{ left: pill.left, width: pill.width, background: BTN_GREEN, boxShadow: "0 6px 18px rgba(16,185,129,.35)" }} />}
    {PERIODS.map((period, index) => <button key={period.days} ref={element => { buttons.current[index] = element; }} type="button" aria-pressed={value === period.days} onClick={() => onChange(period.days)}
      className="relative z-10 h-full rounded-lg px-3.5 text-xs font-semibold transition-colors duration-300" style={{ color: value === period.days ? "#fff" : "var(--text-subtitle)" }}>{period.text}</button>)}
  </div>;
}

/* ─────────────────────────── Painel ─────────────────────────── */

export function SiteAnalyticsDashboard() {
  const [sites, setSites] = useState<SiteTab[]>([]);
  const [site, setSite] = useState("genesycompany");
  const [canManageSites, setCanManageSites] = useState(false);
  const [creating, setCreating] = useState(false);
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Overview | null>(null);
  const [config, setConfig] = useState<SettingsPayload | null>(null);
  const [pipelineId, setPipelineId] = useState("");
  const [stageId, setStageId] = useState("");
  const [dealValue, setDealValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Lead | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const [savingSite, setSavingSite] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [ogOpen, setOgOpen] = useState(false);
  const stages = useMemo(() => config?.pipelines.find(p => p.id === pipelineId)?.crm_stages.filter(s => s.is_active).sort((a, b) => a.order_index - b.order_index) ?? [], [config, pipelineId]);
  const current = sites.find(item => item.site_key === site);
  const isMainSite = site === "genesycompany";
  const siteUrl = `https://${(current?.domain ?? "genesycompany.com").replace(/^https?:\/\//, "")}`;
  const siteHost = (current?.domain ?? "genesycompany.com").replace(/^https?:\/\//, "").split("/")[0];
  const sitePath = (current?.domain ?? "").replace(/^https?:\/\//, "").split("/").slice(1).join("/");
  const canManage = Boolean(config?.canManage);
  const isActive = current?.is_active !== false;

  async function copyLink() {
    try { await navigator.clipboard.writeText(siteUrl); toast.success("Link copiado"); }
    catch { toast.error("Não foi possível copiar o link"); }
  }
  async function loadSites() {
    const response = await fetch("/api/site-analytics/sites");
    const json = await response.json().catch(() => ({}));
    if (!response.ok) return;
    setSites(json.sites ?? []); setCanManageSites(Boolean(json.canManage));
  }
  useEffect(() => { void loadSites(); }, []);

  async function load() {
    setLoading(true);
    const query = `site=${encodeURIComponent(site)}`;
    const [overviewRes, settingsRes] = await Promise.all([fetch(`/api/site-analytics/overview?days=${days}&${query}`), fetch(`/api/site-analytics/settings?${query}`)]);
    const overview = await overviewRes.json(); const settings = await settingsRes.json();
    if (!overviewRes.ok || !settingsRes.ok) toast.error(overview.error ?? settings.error ?? "Não foi possível carregar os dados");
    else { setData(overview); setConfig(settings); setPipelineId(settings.settings?.crm_pipeline_id ?? ""); setStageId(settings.settings?.crm_stage_id ?? ""); setDealValue(String(Number(settings.settings?.deal_value ?? 0) || "")); }
    setLoading(false);
  }
  useEffect(() => { void load(); }, [days, site]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveSettings() {
    setSaving(true);
    const response = await fetch(`/api/site-analytics/settings?site=${encodeURIComponent(site)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pipeline_id: pipelineId || null, stage_id: stageId || null, deal_value: dealValue || 0 }) });
    const json = await response.json(); setSaving(false);
    if (!response.ok) return toast.error(json.error ?? "Não foi possível salvar");
    toast.success("Sincronização com o CRM configurada"); await load();
  }
  async function retry(id: string) {
    const response = await fetch(`/api/site-analytics/leads/${id}/sync`, { method: "POST" });
    const json = await response.json();
    if (!response.ok) return toast.error(json.error ?? "Falha ao sincronizar");
    toast.success("Lead enviado ao CRM"); await load();
  }
  async function patchSite(changes: { domain?: string; is_active?: boolean }, success: string) {
    setSavingSite(true);
    const response = await fetch("/api/site-analytics/sites", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ site_key: site, ...changes }) });
    const json = await response.json().catch(() => ({}));
    setSavingSite(false);
    if (!response.ok) { toast.error(json.error ?? "Não foi possível salvar"); return false; }
    toast.success(success);
    await loadSites();
    return true;
  }
  async function saveUrl() {
    const path = urlDraft.trim().replace(/^\/+|\/+$/g, "").replace(/\s+/g, "-");
    if (await patchSite({ domain: path ? `${siteHost}/${path}` : siteHost }, "Endereço atualizado")) setEditingUrl(false);
  }
  async function toggleActive() {
    if (await patchSite({ is_active: !isActive }, isActive ? "Página desativada" : "Página reativada")) setConfirmToggle(false);
  }
  async function deleteLead() {
    if (!toDelete) return;
    setDeleting(true);
    const response = await fetch(`/api/site-analytics/leads/${toDelete.id}`, { method: "DELETE" });
    const json = await response.json().catch(() => ({}));
    setDeleting(false);
    if (!response.ok) return toast.error(json.error ?? "Não foi possível excluir o lead");
    toast.success("Lead excluído das métricas");
    setToDelete(null);
    await load();
  }

  const tabs = <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Sites e páginas">
    {(sites.length ? sites : [{ site_key: "genesycompany", name: "Site Genesy", domain: "genesycompany.com" }]).map(item => <button key={item.site_key} role="tab" aria-selected={item.site_key === site} onClick={() => { if (item.site_key !== site) { setData(null); setSite(item.site_key); } }}
      className={`flex h-10 items-center gap-2 rounded-xl border px-4 text-xs font-semibold transition ${item.site_key === site ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400" : "hover:bg-white/5"}`} style={item.site_key === site ? undefined : { borderColor: "var(--border-card-hover)", color: "var(--text-subtitle)" }}><Globe2 size={14} />{item.name}{item.is_active === false && <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "var(--hover)", color: "var(--text-muted)" }}>desativada</span>}</button>)}
    {canManageSites && <button onClick={() => setCreating(value => !value)} className="flex h-10 items-center gap-1.5 rounded-xl border border-dashed px-4 text-xs font-semibold transition hover:bg-white/5" style={{ borderColor: "var(--border-card-hover)", color: "var(--text-subtitle)" }}><Plus size={14} /> Nova página</button>}
  </div>;
  const newPage = creating && <NewPageForm onCancel={() => setCreating(false)} onCreated={async key => { setCreating(false); await loadSites(); setData(null); setSite(key); }} />;

  if (loading && !data) return <div className="space-y-5">{tabs}{newPage}<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="lc-card h-[150px] animate-pulse" />)}</div><div className="lc-card h-80 animate-pulse" /></div>;
  if (!data) return <div className="space-y-5">{tabs}{newPage}</div>;

  const { summary, previous, timeline } = data;
  const prevConversion = previous && previous.sessions ? (previous.leads / previous.sessions) * 100 : undefined;
  const synced = data.leads.filter(l => l.sync_status === "synced").length;
  const showVgv = data.leads.some(lead => lead.monthly_vgv);
  const scope = isMainSite ? "do site" : "da página";
  const pipelineName = config?.pipelines.find(p => p.id === pipelineId)?.name;
  const stageName = stages.find(s => s.id === stageId)?.name;

  return <div className="space-y-5">
    {tabs}
    {newPage}

    <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
      <div className="relative flex min-w-0 flex-1 flex-wrap items-center gap-3 rounded-2xl border p-3 pl-3.5 backdrop-blur-xl sm:flex-nowrap" style={{ background: "var(--glass-bg)", borderColor: "var(--glass-border)", boxShadow: "var(--glass-shadow)" }}>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: isActive ? BTN_GREEN : "linear-gradient(135deg, #64748b, #94a3b8)" }}><Globe2 size={18} /></span>
        <div className="min-w-[190px] flex-1">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold">{!isActive
            ? <><span className="h-2 w-2 rounded-full bg-slate-400" /><span style={muted}>Página desativada · não registra acessos nem leads</span></>
            : summary.sessions
              ? <><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span><span className="text-emerald-400">Conectado e recebendo dados</span></>
              : <><span className="h-2 w-2 rounded-full bg-amber-400" /><span className="text-amber-400">Aguardando os primeiros acessos {scope}</span></>}</p>
          {editingUrl
            ? <form className="mt-1 flex items-center gap-2" onSubmit={event => { event.preventDefault(); void saveUrl(); }}>
                <div className="lc-form-control flex h-9 min-w-0 flex-1 items-center overflow-hidden rounded-lg pl-3 text-sm">
                  <span className="shrink-0 select-none" style={muted}>{siteHost}/</span>
                  <input autoFocus value={urlDraft} onChange={event => setUrlDraft(event.target.value.replace(/^\/+/, ""))} placeholder="caminho-da-pagina" className="h-full min-w-0 flex-1 bg-transparent pr-3 outline-none" style={{ color: "var(--text-title)" }} aria-label={`Caminho depois de ${siteHost}/`} />
                </div>
                <button type="submit" disabled={savingSite} aria-label="Salvar endereço" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white disabled:opacity-60" style={{ background: BTN_GREEN }}><Check size={15} /></button>
                <button type="button" onClick={() => setEditingUrl(false)} aria-label="Cancelar" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border" style={{ borderColor: "var(--border-card-hover)", color: "var(--text-subtitle)" }}><X size={15} /></button>
              </form>
            : <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="mt-0.5 block truncate text-base font-semibold hover:underline" style={title}>{(current?.domain ?? "genesycompany.com")}</a>}
        </div>
        {!editingUrl && <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={() => void copyLink()} aria-label="Copiar link da página" title={`Copiar link: ${siteUrl}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition hover:bg-white/5 hover:text-emerald-400" style={{ borderColor: "var(--border-card-hover)", color: "var(--text-subtitle)" }}><Copy size={16} /></button>
          <a href={siteUrl} target="_blank" rel="noopener noreferrer" aria-label="Abrir a página em nova aba" title={`Abrir ${siteUrl}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition hover:bg-white/5 hover:text-emerald-400" style={{ borderColor: "var(--border-card-hover)", color: "var(--text-subtitle)" }}><ExternalLink size={16} /></a>
          {canManage && <button type="button" onClick={() => { setUrlDraft(sitePath); setEditingUrl(true); }} aria-label="Editar endereço" title="Editar endereço" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition hover:bg-white/5 hover:text-emerald-400" style={{ borderColor: "var(--border-card-hover)", color: "var(--text-subtitle)" }}><Pencil size={15} /></button>}
          {canManage && <button type="button" onClick={() => setOgOpen(true)} aria-label="Banner do link" title="Banner do link (WhatsApp, Instagram)" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition hover:bg-white/5 hover:text-emerald-400" style={{ borderColor: "var(--border-card-hover)", color: "var(--text-subtitle)" }}><ImageIcon size={16} /></button>}
          {canManage && !isMainSite && <button type="button" onClick={() => isActive ? setConfirmToggle(true) : void toggleActive()} aria-label={isActive ? "Desativar página" : "Reativar página"} title={isActive ? "Desativar página" : "Reativar página"}
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition ${isActive ? "hover:bg-rose-500/10 hover:text-rose-400" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"}`} style={isActive ? { borderColor: "var(--border-card-hover)", color: "var(--text-subtitle)" } : undefined}><Power size={16} /></button>}
        </div>}
      </div>
      <div className="flex items-center"><PeriodSwitch value={days} onChange={setDays} /></div>
    </div>

    <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
      <Kpi icon={<Users size={16} />} name="Acessos" value={nf(summary.sessions)} detail={`${nf(summary.visitors)} visitantes únicos`} delta={<Delta current={summary.sessions} previous={previous?.sessions} />} spark={timeline.map(r => r.sessions)} color="#34d399" />
      <Kpi icon={<UserRound size={16} />} name="Leads" value={nf(summary.leads)} detail={`capturados ${scope}`} delta={<Delta current={summary.leads} previous={previous?.leads} />} spark={timeline.map(r => r.leads)} color="#fbbf24" />
      <Kpi icon={<TrendingUp size={16} />} name="Conversão" value={pctText(summary.conversion_rate)} detail="acessos que viraram lead" delta={prevConversion !== undefined ? <Delta current={summary.conversion_rate} previous={prevConversion} points /> : undefined} color="#a78bfa" />
      <Kpi icon={<Eye size={16} />} name="Visualizações" value={nf(summary.views)} detail="páginas vistas" spark={timeline.map(r => r.views)} color="#38bdf8" />
      <Kpi icon={<Clock3 size={16} />} name="Tempo médio" value={duration(summary.avg_seconds)} detail="tempo ativo por acesso" color="#2dd4bf" />
      <Kpi icon={<RefreshCw size={16} />} name="No CRM" value={`${nf(synced)}/${nf(data.leads.length)}`} detail="leads sincronizados" color="#34d399"
        delta={data.leads.length ? <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${synced === data.leads.length ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>{synced === data.leads.length ? "tudo sincronizado" : `${data.leads.length - synced} pendente(s)`}</span> : undefined} />
    </div>
    <p className="-mt-2 text-[11px]" style={{ color: "var(--text-muted)" }}>Variação comparada aos {days} dias anteriores.</p>

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Card heading="Evolução dos acessos" subtitle="Toque nas legendas para mostrar ou esconder cada linha; passe o mouse para ver o dia." icon={<TrendingUp size={16} />}><TimelineChart rows={timeline} /></Card>
      <Card heading={isMainSite ? "Funil do site" : "Funil da página"} subtitle="Do acesso até virar lead" icon={<UserRound size={16} />}><Funnel steps={data.funnel ?? []} /></Card>
    </div>

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Card heading="De onde vêm os acessos" subtitle="Pela UTM, por códigos de anúncio ou pelo app/site de onde a pessoa veio" icon={<Globe2 size={16} />}><ShareList rows={data.sources} empty="Sem acessos no período." /></Card>
      <Card heading="Dispositivos" subtitle="Celular, computador ou tablet" icon={<Smartphone size={16} />}><Donut rows={data.devices ?? []} unit="acessos" iconFor={deviceIcon} /></Card>
      <Card heading="Campanhas" subtitle="Acessos por utm_campaign" icon={<TrendingUp size={16} />}><ShareList rows={data.campaigns} empty="Nenhum acesso com campanha (UTM)." /></Card>
      <Card heading="Seções mais vistas" subtitle={`% dos acessos que chegaram a cada parte ${scope}`} icon={<Eye size={16} />}><ShareList rows={data.sections} base={summary.sessions} colored={false} empty="Sem dados de seções." /></Card>
      <Card heading="Cliques" subtitle={data.whatsapp_clicks ? `Botões e links mais clicados · ${nf(data.whatsapp_clicks)} no WhatsApp` : "Botões e links mais clicados"} icon={<MousePointerClick size={16} />}><Donut rows={data.clicks ?? []} unit="cliques" legendFirst /></Card>
      <section className="lc-card relative min-w-0 overflow-hidden p-5">
        <Glow spots={[{ color: "#10b981", className: "-right-40 -top-48 h-[30rem] w-[30rem]", opacity: 0.26 }, { color: "#2dd4bf", className: "-bottom-56 -left-40 h-[26rem] w-[26rem]", opacity: 0.12 }]} />
        <div className="relative">
          <header className="mb-5 flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white" style={{ background: BTN_GREEN, boxShadow: "0 10px 30px rgba(16,185,129,.35)" }}><Settings2 size={18} /></span>
            <div className="min-w-0"><h2 className="text-base font-semibold" style={title}>Pipeline do CRM</h2><p className="mt-0.5 text-xs" style={muted}>Para onde vão os novos leads {scope}</p></div>
          </header>
          <div className="space-y-3">
            <Field text="Pipeline"><select value={pipelineId} onChange={e => { setPipelineId(e.target.value); setStageId(""); }} disabled={!canManage} className={fieldCls}><option value="">Não sincronizar</option>{config?.pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
            <Field text="Etapa inicial"><select value={stageId} onChange={e => setStageId(e.target.value)} disabled={!pipelineId || !canManage} className={fieldCls}><option value="">Selecionar etapa</option>{stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field text="Valor do negócio (R$)"><input type="number" min={0} step="0.01" inputMode="decimal" value={dealValue} onChange={e => setDealValue(e.target.value)} disabled={!canManage} placeholder="0,00" className={fieldCls} /></Field>
            {pipelineName && stageName && <div className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs" style={{ borderColor: "rgba(16,185,129,.35)", background: "rgba(16,185,129,.08)", color: "var(--text-subtitle)" }}><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: BTN_GREEN }} /><span>Novos leads entram em <strong className="text-emerald-400">{pipelineName}</strong> → <strong className="text-emerald-400">{stageName}</strong></span></div>}
            {canManage && <button onClick={() => void saveSettings()} disabled={saving || (!!pipelineId && !stageId)} className="h-12 w-full rounded-xl text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50" style={{ background: BTN_GREEN, boxShadow: "0 12px 30px rgba(16,185,129,.28)" }}>{saving ? "Salvando…" : "Salvar integração"}</button>}
          </div>
        </div>
      </section>
    </div>

    {config && <PixelPanel site={site} key={`${site}:${config.settings?.meta_pixel_id ?? ""}:${config.settings?.has_capi_token ? 1 : 0}:${config.settings?.meta_pixel_enabled ? 1 : 0}`} pixel={data.pixel} settings={config.settings} canManage={config.canManage} onSaved={load} />}

    <section className="lc-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5" style={{ borderColor: "var(--border)" }}>
        <div><h2 className="flex items-center gap-2 text-sm font-semibold" style={title}>{isMainSite ? "Leads do site" : `Leads · ${current?.name ?? "página"}`}<span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">{nf(data.leads.length)}</span></h2><p className="mt-0.5 text-xs" style={muted}>Contato, perfil e situação no CRM</p></div>
      </div>
      {data.leads.length ? <div className="max-h-[480px] overflow-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead className="sticky top-0 z-10 backdrop-blur-xl" style={{ background: "var(--popover)" }}><tr className="text-[11px] font-semibold" style={{ color: "var(--text-subtitle)" }}>
            <th className="px-5 py-3">Lead</th><th className="px-4 py-3">Perfil</th>{showVgv && <th className="px-4 py-3">VGV mensal</th>}<th className="px-4 py-3">Data</th><th className="px-4 py-3">CRM</th>{canManage && <th className="w-14 px-4 py-3"><span className="sr-only">Ações</span></th>}
          </tr></thead>
          <tbody>{data.leads.map(lead => <tr key={lead.id} className="group border-t transition hover:bg-white/[0.03]" style={{ borderColor: "var(--border)" }}>
            <td className="px-5 py-3.5"><p className="text-sm font-semibold" style={title}>{lead.name}</p><p className="mt-0.5 text-xs" style={muted}>{lead.phone}{lead.email ? <> · {lead.email}</> : null}</p></td>
            <td className="px-4 py-3.5">{lead.profile ? <span className="rounded-lg px-2 py-1 text-xs font-medium" style={{ background: "var(--hover)", color: "var(--text-subtitle)" }}>{lead.profile}</span> : <span style={muted}>—</span>}</td>
            {showVgv && <td className="px-4 py-3.5 text-xs" style={{ color: "var(--text-subtitle)" }}>{lead.monthly_vgv ?? "—"}</td>}
            <td className="px-4 py-3.5 text-xs tabular-nums" style={{ color: "var(--text-subtitle)" }}>{new Date(lead.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td>
            <td className="px-4 py-3.5">{lead.sync_status === "synced" ? <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">Sincronizado</span> : <button onClick={() => void retry(lead.id)} title={lead.sync_error ?? undefined} className="rounded-lg bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-400">{lead.sync_status === "disabled" ? "Configurar e enviar" : "Tentar novamente"}</button>}</td>
            {canManage && <td className="px-4 py-3.5 text-right"><button onClick={() => setToDelete(lead)} aria-label={`Excluir ${lead.name} das métricas`} title="Excluir das métricas" className="grid h-9 w-9 place-items-center rounded-lg transition hover:bg-rose-500/10 hover:text-rose-400" style={{ color: "var(--text-muted)" }}><Trash2 size={16} /></button></td>}
          </tr>)}</tbody>
        </table>
      </div> : <p className="p-10 text-center text-sm" style={muted}>Os novos leads {isMainSite ? "do site" : "desta página"} aparecerão aqui.</p>}
    </section>

    {toDelete && <ConfirmDialog icon={<Trash2 size={18} />} heading={`Excluir “${toDelete.name}” das métricas?`} confirmText="Excluir das métricas" busyText="Excluindo…" busy={deleting} onCancel={() => setToDelete(null)} onConfirm={() => void deleteLead()}>
      O lead sai da lista, do funil e da taxa de conversão desta página. <strong style={{ color: "var(--text-subtitle)" }}>No CRM ele continua</strong>; se quiser removê-lo de lá, exclua pelo CRM.
    </ConfirmDialog>}
    {ogOpen && <OgImageDialog site={site} name={current?.name ?? "Site Genesy"} domain={current?.domain ?? "genesycompany.com"} current={config?.settings?.og_image_url ?? null} onClose={() => setOgOpen(false)} onSaved={load} />}
    {confirmToggle && <ConfirmDialog icon={<Power size={18} />} tone="amber" heading={`Desativar “${current?.name ?? "página"}”?`} confirmText="Desativar página" busyText="Desativando…" busy={savingSite} onCancel={() => setConfirmToggle(false)} onConfirm={() => void toggleActive()}>
      A página continua no ar, mas para de registrar acessos e <strong style={{ color: "var(--text-subtitle)" }}>os leads do formulário deixam de chegar ao CRM</strong>. Os dados já coletados ficam guardados e você pode reativar quando quiser.
    </ConfirmDialog>}
  </div>;
}
