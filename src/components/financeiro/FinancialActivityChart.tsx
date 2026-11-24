"use client";

import { useId, useMemo, useState } from "react";
import { useSegmentIndicator } from "@/components/ui/useSegmentIndicator";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EyeOff } from "lucide-react";
import { privateFinancialValue, useFinancialPrivacyStore } from "@/store/financial-privacy";

const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Full calendar days are supplied by the caller, including days with no entries. */
export function FinancialActivityChart({ title, description, data, color = "#38bdf8" }: {
  title: string; description: string; data: { date: string; total: number }[]; color?: string;
}) {
  const hidden = useFinancialPrivacyStore(state => state.valuesHidden);
  const [mode, setMode] = useState<"daily" | "cumulative">("daily");
  const modeSeg = useSegmentIndicator({ background: "var(--segment-active-bg)" }, { activeSelector: '[aria-pressed="true"]' });
  const gradient = `financial-${useId().replace(/:/g, "")}`;
  const points = useMemo(() => {
    let sum = 0;
    return data.map(point => ({ ...point, cumulative: sum += point.total }));
  }, [data]);
  const axes = <>
    <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 6" />
    <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} tickMargin={10} />
    <YAxis width={48} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : String(v)} />
    <Tooltip content={({ active, payload, label }) => active && payload?.length ? <div className="fin-chart-tooltip"><small>Dia {label} · {mode === "daily" ? "Lançamentos" : "Acumulado"}</small><strong>{brl(Number(payload[0].value))}</strong></div> : null} cursor={{ stroke: color, strokeOpacity: .2 }} />
  </>;
  return <section className="fin-panel fin-chart-panel" aria-label={title}>
    <header><div><h3>{title}</h3><p>{description}</p></div><div ref={modeSeg.trackRef} className="fin-segments" role="group" aria-label={`Exibição: ${title}`}>{modeSeg.indicator}
      <button type="button" aria-pressed={mode === "daily"} onClick={() => setMode("daily")}>Diário</button>
      <button type="button" aria-pressed={mode === "cumulative"} onClick={() => setMode("cumulative")}>Acumulado</button>
    </div></header>
    <div className="fin-chart-canvas">
      {hidden ? <div className="fin-chart-empty"><EyeOff size={20} /><p>Valores ocultos</p></div> : !data.some(point => point.total !== 0) ? <div className="fin-chart-empty"><p>Nenhum lançamento neste período.</p></div> : <ResponsiveContainer width="100%" height="100%">
        {mode === "daily" ? <BarChart data={points} margin={{ top: 10, right: 6, bottom: 0, left: 0 }}>{axes}<Bar dataKey="total" fill={color} fillOpacity={.8} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} /></BarChart>
          : <AreaChart data={points} margin={{ top: 10, right: 6, bottom: 0, left: 0 }}><defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={.3} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>{axes}<Area type="stepAfter" dataKey="cumulative" stroke={color} strokeWidth={2} fill={`url(#${gradient})`} isAnimationActive={false} /></AreaChart>}
      </ResponsiveContainer>}
    </div>
    <p className="fin-chart-footnote">{mode === "daily" ? "Valores por dia, incluindo dias sem movimentação." : "Soma dos lançamentos até cada dia do mês."}</p>
  </section>;
}

export function FinancialBreakdown({ title, description, rows, selected, onSelect, baseTotal }: {
  title: string; description: string; rows: { id: string; label: string; total: number }[];
  selected?: string; onSelect?: (id: string) => void;
  baseTotal?: number;
}) {
  const hidden = useFinancialPrivacyStore(state => state.valuesHidden);
  const total = baseTotal ?? rows.reduce((sum, row) => sum + Math.max(0, row.total), 0);
  return <section className="fin-panel fin-breakdown"><header><div><h3>{title}</h3><p>{description}</p></div></header>
    {!rows.length ? <p className="fin-chart-empty">Sem dados no período.</p> : rows.map(row => {
      const share = total > 0 ? Math.max(0, row.total) / total * 100 : 0;
      const content = <><span><b>{row.label}</b><strong>{privateFinancialValue(brl(row.total))}</strong></span><div className="fin-share-track" aria-hidden="true"><i style={{ width: hidden ? 0 : `${share}%` }} /></div><small>{hidden ? "••••" : `${share.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do total`}</small></>;
      return onSelect ? <button type="button" key={row.id} className="fin-breakdown-row" aria-pressed={selected === row.id} onClick={() => onSelect(row.id)}>{content}</button> : <div key={row.id} className="fin-breakdown-row">{content}</div>;
    })}
  </section>;
}
