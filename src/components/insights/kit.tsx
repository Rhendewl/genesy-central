"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Kit visual de Insights — mesmas peças dos Insights do site (cards de vidro,
// KPI com sparkline, rosca em gradiente, barras de participação e gráfico de
// evolução), reaproveitáveis em formulários, CRM e outros painéis.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

/** Pares [claro, forte] — funcionam nos temas claro e escuro. */
export const GRADIENTS: Array<[string, string]> = [["#6ee7b7", "#10b981"], ["#7dd3fc", "#0284c7"], ["#c4b5fd", "#7c3aed"], ["#fcd34d", "#d97706"], ["#fda4af", "#e11d48"], ["#5eead4", "#0d9488"], ["#f9a8d4", "#db2777"], ["#cbd5e1", "#64748b"]];
export const gradient = (index: number, angle = 90) => { const [light, strong] = GRADIENTS[index % GRADIENTS.length]; return `linear-gradient(${angle}deg, ${strong}, ${light})`; };
export const solidGradient = (color: string, angle = 135) => `linear-gradient(${angle}deg, ${color}, ${color}b3)`;
export const BTN_GREEN = "linear-gradient(135deg, #059669, #10b981 55%, #34d399)";

export const nf = (value: number) => value.toLocaleString("pt-BR");
export const pctOf = (value: number, total: number) => (total ? (value / total) * 100 : 0);
export const pctText = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: value < 10 ? 1 : 0 })}%`;
export const duration = (seconds: number | null | undefined) => {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "—";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m}min ${s % 60}s` : `${m}min`;
  return `${Math.floor(m / 60)}h ${m % 60}min`;
};
export const niceMax = (value: number) => {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find(s => s * magnitude * 4 >= value) ?? 10;
  return step * magnitude * 4;
};
export const muted = { color: "var(--text-body)" } as const;
export const title = { color: "var(--text-title)" } as const;

export function Card({ heading, subtitle, icon, action, className = "", children, iconColor = "#34d399" }: { heading: string; subtitle?: ReactNode; icon?: ReactNode; action?: ReactNode; className?: string; children: ReactNode; iconColor?: string }) {
  return <section className={`lc-card min-w-0 p-5 ${className}`}>
    <header className="mb-4 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {icon && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `${iconColor}1a`, color: iconColor }}>{icon}</span>}
        <div className="min-w-0"><h2 className="text-sm font-semibold" style={title}>{heading}</h2>{subtitle && <p className="mt-0.5 text-xs" style={muted}>{subtitle}</p>}</div>
      </div>
      {action}
    </header>
    {children}
  </section>;
}

/** Brilho de fundo recortado pelo contorno arredondado do card. */
export function Glow({ spots }: { spots: Array<{ color: string; className: string; opacity: number }> }) {
  return <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={{ borderRadius: "inherit", clipPath: "inset(0 round 20px)" }}>
    {spots.map((spot, index) => <div key={index} className={`absolute rounded-full ${spot.className}`} style={{ background: `radial-gradient(circle, ${spot.color} 0%, transparent 68%)`, opacity: spot.opacity }} />)}
  </div>;
}

export function Empty({ text, className = "min-h-[120px]" }: { text: string; className?: string }) {
  return <p className={`grid place-items-center rounded-xl border border-dashed px-4 text-center text-xs ${className}`} style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>{text}</p>;
}

export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const id = `spark-${useId().replace(/:/g, "")}`;
  if (values.length < 2 || !values.some(Boolean)) return <div className="h-10" />;
  const max = Math.max(...values, 1);
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${38 - (value / max) * 32}`);
  return <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-10 w-full" aria-hidden>
    <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.35} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
    <polygon points={`0,40 ${points.join(" ")} 100,40`} fill={`url(#${id})`} />
    <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
  </svg>;
}

/** Variação contra o período anterior. `points` = diferença em pontos percentuais; `inverse` = cair é bom. */
export function Delta({ current, previous, points, inverse }: { current: number | null | undefined; previous?: number | null; points?: boolean; inverse?: boolean }) {
  if (previous === undefined || previous === null || current === null || current === undefined) return null;
  if (!previous && !current) return <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>sem dados antes</span>;
  if (!previous && !points) return <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">novo</span>;
  const diff = points ? current - previous : ((current - previous) / previous) * 100;
  if (Math.abs(diff) < 0.05) return <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "var(--hover)", color: "var(--text-subtitle)" }}>estável</span>;
  const up = diff >= 0;
  const good = inverse ? !up : up;
  const text = points ? `${up ? "+" : ""}${diff.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.` : `${up ? "+" : ""}${pctText(diff)}`;
  return <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${good ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
    {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{text}
  </span>;
}

export function Kpi({ icon, name, value, detail, delta, spark, color = "#34d399", hint }: { icon: ReactNode; name: string; value: string; detail: ReactNode; delta?: ReactNode; spark?: number[]; color?: string; hint?: string }) {
  return <div className="lc-card relative flex min-h-[150px] min-w-0 flex-col overflow-hidden p-3.5 sm:p-4" title={hint}>
    <div className="flex items-center justify-between gap-2"><p className="text-xs font-medium" style={{ color: "var(--text-subtitle)" }}>{name}</p><span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `${color}1f`, color }}>{icon}</span></div>
    <strong className="mt-2 block text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl" style={title}>{value}</strong>
    <div className="mt-1 flex flex-wrap items-center gap-2"><span className="text-[11px]" style={muted}>{detail}</span>{delta}</div>
    {spark && <div className="mt-auto -mx-1 pt-2"><Sparkline values={spark} color={color} /></div>}
  </div>;
}

export type DonutRow = { name: string; value: number; color?: string; label?: string };

/** Rosca com gradiente em cada fatia e legenda ao lado. */
export function Donut({ rows, unit, iconFor, legendFirst = false, limit = 6, centerLabel, onSelect, selected }: { rows: DonutRow[]; unit: string; iconFor?: (name: string) => ReactNode; legendFirst?: boolean; limit?: number; centerLabel?: string; onSelect?: (name: string) => void; selected?: string | null }) {
  const uid = useId().replace(/:/g, "");
  const sorted = [...rows].filter(row => row.value > 0).sort((x, y) => y.value - x.value);
  const list: DonutRow[] = sorted.length > limit ? [...sorted.slice(0, limit - 1), { name: "__outros", label: "Outros", value: sorted.slice(limit - 1).reduce((sum, row) => sum + row.value, 0), color: "#94a3b8" }] : sorted;
  const total = list.reduce((sum, row) => sum + row.value, 0);
  if (!total) return <Empty text={`Nenhum registro de ${unit} no período.`} />;
  const radius = 44, circumference = 2 * Math.PI * radius;
  let offset = 0;
  const stops = (row: DonutRow, index: number): [string, string] => row.color ? [`${row.color}cc`, row.color] : GRADIENTS[index % GRADIENTS.length];
  const chart = <div className="relative h-36 w-36 shrink-0">
    <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
      <defs>{list.map((row, index) => <linearGradient key={row.name} id={`${uid}-${index}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="120" y2="120"><stop offset="0%" stopColor={stops(row, index)[0]} /><stop offset="100%" stopColor={stops(row, index)[1]} /></linearGradient>)}</defs>
      <circle cx={60} cy={60} r={radius} fill="none" stroke="var(--hover)" strokeWidth={14} />
      {list.map((row, index) => {
        const length = (row.value / total) * circumference;
        const dim = selected && selected !== row.name;
        const segment = <circle key={row.name} cx={60} cy={60} r={radius} fill="none" stroke={`url(#${uid}-${index})`} strokeWidth={selected === row.name ? 17 : 14} opacity={dim ? 0.35 : 1} strokeDasharray={`${Math.max(0.01, length - (list.length > 1 ? 2.5 : 0))} ${circumference}`} strokeDashoffset={-offset} strokeLinecap={list.length > 1 ? "round" : "butt"} className="transition-all duration-300" />;
        offset += length;
        return segment;
      })}
    </svg>
    <div className="absolute inset-0 grid place-items-center text-center"><div><strong className="block text-2xl tabular-nums" style={title}>{nf(total)}</strong><span className="text-[11px]" style={muted}>{centerLabel ?? unit}</span></div></div>
  </div>;
  const legend = <ul className="min-w-[185px] flex-1 space-y-1.5">
    {list.map((row, index) => {
      const swatch = row.color ? solidGradient(row.color) : gradient(index, 135);
      const content = <>
        <span className="flex min-w-0 items-center gap-2" style={{ color: "var(--text-subtitle)" }}>
          {iconFor ? <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-white" style={{ background: swatch }}>{iconFor(row.name)}</span> : <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: swatch }} />}
          <span className="text-left leading-snug [overflow-wrap:anywhere]">{row.label ?? row.name}</span>
        </span>
        <span className="shrink-0 tabular-nums"><strong style={title}>{pctText(pctOf(row.value, total))}</strong> <span style={muted}>· {nf(row.value)}</span></span>
      </>;
      return <li key={row.name}>
        {onSelect && row.name !== "__outros"
          ? <button type="button" onClick={() => onSelect(row.name)} aria-pressed={selected === row.name} className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-xs transition hover:bg-white/5" style={selected === row.name ? { background: "var(--hover)" } : undefined}>{content}</button>
          : <div className="flex items-center justify-between gap-3 px-2 py-1.5 text-xs">{content}</div>}
      </li>;
    })}
  </ul>;
  return <div className="flex flex-wrap items-center gap-5">{legendFirst ? <>{legend}{chart}</> : <>{chart}{legend}</>}</div>;
}

/** Lista com barra, valor e porcentagem (sobre o total ou sobre uma base informada). */
export function ShareList({ rows, base, empty, colored = true, limit = 6 }: { rows?: Array<{ name: string; value: number; label?: string; color?: string; extra?: ReactNode }>; base?: number; empty: string; colored?: boolean; limit?: number }) {
  const list = (rows ?? []).slice(0, limit);
  if (!list.length) return <Empty text={empty} />;
  const total = base ?? list.reduce((sum, row) => sum + row.value, 0);
  return <ul className="space-y-3">
    {list.map((row, index) => {
      const fill = row.color ? solidGradient(row.color, 90) : colored ? gradient(index) : gradient(0);
      const share = pctOf(row.value, total);
      return <li key={row.name}>
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="flex min-w-0 items-center gap-2" style={{ color: "var(--text-subtitle)" }}><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: fill }} /><span className="truncate" title={row.label ?? row.name}>{row.label ?? row.name}</span></span>
          <span className="shrink-0 tabular-nums">{row.extra}<strong className="text-sm" style={title}>{nf(row.value)}</strong> <span className="inline-block w-12 text-right" style={muted}>{pctText(share)}</span></span>
        </div>
        <div className="mt-1.5 h-2 rounded-full" style={{ background: "var(--hover)" }}><div className="h-2 rounded-full transition-all duration-700" style={{ width: `${Math.max(2, Math.min(100, share))}%`, background: fill }} /></div>
      </li>;
    })}
  </ul>;
}

/** Seletor em pílula (mesmo do período dos Insights do site). */
export function PillSwitch<T extends string | number>({ options, value, onChange, label }: { options: Array<{ value: T; text: string }>; value: T; onChange: (value: T) => void; label: string }) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  useEffect(() => {
    const measure = () => {
      const element = buttons.current[options.findIndex(option => option.value === value)];
      setPill(element ? { left: element.offsetLeft, width: element.offsetWidth } : null);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [value, options]);
  return <div className="relative flex h-10 shrink-0 items-center rounded-xl border p-1" style={{ borderColor: "var(--border-card-hover)", background: "var(--hover)" }} role="group" aria-label={label}>
    {pill && <span aria-hidden className="absolute bottom-1 top-1 rounded-lg transition-all duration-300 ease-out" style={{ left: pill.left, width: pill.width, background: "linear-gradient(180deg,#ffffff,#e6e9ed)", boxShadow: "0 4px 16px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.9)" }} />}
    {options.map((option, index) => <button key={String(option.value)} ref={element => { buttons.current[index] = element; }} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}
      className="relative z-10 h-full whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition-colors duration-300" style={{ color: value === option.value ? "#0b0b0c" : "var(--text-subtitle)" }}>{option.text}</button>)}
  </div>;
}

export type TimelineSeries<K extends string> = { key: K; name: string; color: string; kind: "bar" | "line"; axis?: "left" | "right"; format?: (value: number) => string };

/** Barras + linha com legenda clicável e detalhe ao passar o mouse. */
export function TimelineChart<K extends string>({ rows, series, labelFor, tooltipFor, height = 260, defaultHidden = [] }: { rows: Array<{ key: string } & Record<K, number>>; series: TimelineSeries<K>[]; labelFor: (key: string) => string; tooltipFor?: (key: string) => string; height?: number; defaultHidden?: K[] }) {
  const box = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/:/g, "");
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [hidden, setHidden] = useState<Set<K>>(() => new Set(defaultHidden));
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const visible = series.filter(item => !hidden.has(item.key));
  const bars = visible.filter(item => item.kind === "bar");
  const lines = visible.filter(item => item.kind === "line");
  const rightLines = lines.filter(item => item.axis === "right");
  const H = height, padL = 36, padR = rightLines.length ? 40 : 12, padT = 14, padB = 28;
  const innerW = Math.max(0, width - padL - padR), innerH = H - padT - padB;
  const step = innerW / Math.max(1, rows.length);
  const leftMax = niceMax(Math.max(1, ...rows.flatMap(row => [...bars, ...lines.filter(l => l.axis !== "right")].map(item => row[item.key] ?? 0))));
  const rightMax = rightLines.length ? niceMax(Math.max(1, ...rows.flatMap(row => rightLines.map(item => row[item.key] ?? 0)))) : 1;
  const y = (value: number, max: number) => padT + innerH - (value / max) * innerH;
  const barW = Math.max(1.5, (step * 0.66) / Math.max(1, bars.length));
  const every = Math.ceil(rows.length / Math.max(2, Math.floor(innerW / 64)));
  const active = hover !== null ? rows[hover] : null;
  const fmt = (item: TimelineSeries<K>, value: number) => (item.format ? item.format(value) : nf(value));
  const totalOf = (item: TimelineSeries<K>) => rows.reduce((sum, row) => sum + (row[item.key] ?? 0), 0);
  return <div>
    <div className="mb-4 flex flex-wrap gap-2">
      {series.map(item => {
        const on = !hidden.has(item.key);
        return <button key={item.key} type="button" aria-pressed={on} onClick={() => setHidden(current => { const next = new Set(current); if (next.has(item.key)) next.delete(item.key); else next.add(item.key); return next; })}
          className="flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition hover:bg-white/5" style={{ borderColor: on ? `${item.color}66` : "var(--border)", opacity: on ? 1 : 0.55 }}>
          <span className={item.kind === "line" ? "h-0.5 w-3 rounded-full" : "h-2.5 w-2.5 rounded-full"} style={{ background: item.color }} />
          <span><span className="block text-[11px]" style={muted}>{item.name}</span>{!item.format && <strong className="block text-base tabular-nums leading-tight" style={title}>{nf(totalOf(item))}</strong>}</span>
        </button>;
      })}
    </div>
    <div ref={box} className="relative w-full min-w-0 overflow-hidden" style={{ height: H }} onMouseLeave={() => setHover(null)}>
      {width > 0 && <svg width={width} height={H} className="block" role="img" aria-label="Evolução no período"
        onMouseMove={event => { const x = event.clientX - event.currentTarget.getBoundingClientRect().left - padL; setHover(Math.min(rows.length - 1, Math.max(0, Math.floor(x / step)))); }}>
        <defs>{bars.map(bar => <linearGradient key={bar.key} id={`${uid}-${bar.key}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={bar.color} stopOpacity={0.95} /><stop offset="100%" stopColor={bar.color} stopOpacity={0.35} /></linearGradient>)}</defs>
        {[0, 0.25, 0.5, 0.75, 1].map(f => <g key={f}>
          <line x1={padL} x2={width - padR} y1={padT + innerH * (1 - f)} y2={padT + innerH * (1 - f)} stroke="var(--chart-grid)" />
          <text x={padL - 8} y={padT + innerH * (1 - f) + 4} textAnchor="end" fontSize={10} fill="var(--text-muted)">{nf(Math.round(leftMax * f))}</text>
          {rightLines.length > 0 && <text x={width - padR + 8} y={padT + innerH * (1 - f) + 4} fontSize={10} fill={rightLines[0].color} opacity={0.85}>{fmt(rightLines[0], Math.round(rightMax * f))}</text>}
        </g>)}
        {hover !== null && <rect x={padL + hover * step} y={padT} width={step} height={innerH} fill="var(--hover)" rx={4} />}
        {rows.map((row, index) => bars.map((bar, b) => {
          const value = row[bar.key] ?? 0;
          const top = y(value, leftMax);
          return <rect key={`${row.key}-${bar.key}`} x={padL + index * step + (step - barW * bars.length) / 2 + b * barW} y={top} width={Math.max(1, barW - 1)} height={Math.max(0, padT + innerH - top)} rx={Math.min(4, barW / 2)} fill={`url(#${uid}-${bar.key})`} opacity={hover === null || hover === index ? 1 : 0.55} />;
        }))}
        {lines.map(line => {
          const max = line.axis === "right" ? rightMax : leftMax;
          const points = rows.map((row, index) => `${padL + index * step + step / 2},${y(row[line.key] ?? 0, max)}`).join(" ");
          return <g key={line.key}>
            <polyline points={points} fill="none" stroke={line.color} strokeWidth={2} strokeLinejoin="round" />
            {rows.map((row, index) => (row[line.key] ?? 0) > 0 && <circle key={row.key} cx={padL + index * step + step / 2} cy={y(row[line.key] ?? 0, max)} r={hover === index ? 5 : 3} fill={line.color} stroke="var(--background)" strokeWidth={2} />)}
          </g>;
        })}
        {rows.map((row, index) => index % every === 0 && <text key={row.key} x={padL + index * step + step / 2} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--text-muted)">{labelFor(row.key)}</text>)}
      </svg>}
      {active && hover !== null && <div className="pointer-events-none absolute top-2 z-10 min-w-[170px] rounded-xl border px-3 py-2 text-xs shadow-xl backdrop-blur-md"
        style={{ left: Math.min(width - 180, Math.max(0, padL + hover * step + step / 2 - 85)), background: "var(--chart-tooltip-bg)", borderColor: "var(--chart-tooltip-border)", color: "var(--chart-tooltip-text)" }}>
        <p className="mb-1 font-semibold">{(tooltipFor ?? labelFor)(active.key)}</p>
        {series.map(item => <p key={item.key} className="flex items-center justify-between gap-4"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: item.color }} />{item.name}</span><strong className="tabular-nums">{fmt(item, active[item.key] ?? 0)}</strong></p>)}
      </div>}
    </div>
  </div>;
}
