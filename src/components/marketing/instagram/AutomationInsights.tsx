"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Clock3, Database, MessageSquareText, MousePointerClick, RefreshCw, Target, Users, Zap,
} from "lucide-react";
import type { AutomationInsights as Insights } from "@/lib/instagram-automation/insights";
import "./automation-insights.css";

export type InsightsAutomation = { id: string; name: string; status: "draft" | "active" | "paused"; trigger_type: string };

const PERIODS = [7, 30, 90] as const;
const TRIGGERS: Record<string, string> = { comment: "Comentário", message: "Mensagem no Direct", story_reply: "Resposta a story", postback: "Toque em botão" };
const STATUS: Record<string, string> = { completed: "Concluiu", waiting: "Aguardando", running: "Em andamento", queued: "Na fila", partial: "Parcial", failed: "Falhou" };

const number = (value: number) => value.toLocaleString("pt-BR");
const percent = (value: number) => `${Math.round(value * 100)}%`;

function duration(seconds: number | null) {
  if (seconds === null) return "—";
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h${minutes % 60 ? ` ${minutes % 60}min` : ""}`;
  return `${Math.round(hours / 24)} dias`;
}

function delta(current: number, previous: number) {
  if (!previous) return current ? { label: "novo no período", tone: "up" as const } : null;
  const change = (current - previous) / previous;
  if (Math.abs(change) < 0.005) return { label: "igual ao período anterior", tone: "flat" as const };
  return { label: `${change > 0 ? "+" : ""}${Math.round(change * 100)}% vs. período anterior`, tone: change > 0 ? "up" as const : "down" as const };
}

function phone(value: string | null) {
  if (!value) return "—";
  const digits = value.replace(/\D/g, "");
  const local = digits.length >= 12 && digits.indexOf("55") === 0 ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return value;
}

function shortDate(key: string) {
  const [, month, day] = key.split("-");
  return `${day}/${month}`;
}

/** Clean tick step for a 0..max axis with about four lines. */
function niceMax(max: number) {
  if (max <= 4) return 4;
  const raw = max / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(factor => factor * magnitude).find(candidate => candidate >= raw) ?? raw;
  return step * 4;
}

export function AutomationInsights({ automations, initialId }: { automations: InsightsAutomation[]; initialId?: string | null }) {
  const [selectedId, setSelectedId] = useState<string>(initialId || automations[0]?.id || "");
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (initialId) setSelectedId(initialId); }, [initialId]);
  useEffect(() => {
    if (!selectedId && automations[0]) setSelectedId(automations[0].id);
  }, [automations, selectedId]);

  const load = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/marketing/instagram/automations/${selectedId}/insights?days=${days}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar os insights");
      setData(body.insights as Insights);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar os insights");
    } finally {
      setLoading(false);
    }
  }, [days, selectedId]);
  useEffect(() => { void load(); }, [load]);

  const selected = automations.find(item => item.id === selectedId) ?? null;

  if (!automations.length) {
    return <div className="ig-ins-empty ig-glass"><Zap size={20} /><b>Nenhum fluxo ainda</b><span>Crie um fluxo para acompanhar os resultados aqui.</span></div>;
  }

  return (
    <div className="ig-ins">
      <div className="ig-ins-toolbar">
        <label className="ig-ins-select">
          <span>Fluxo</span>
          <select value={selectedId} onChange={event => setSelectedId(event.target.value)}>
            {automations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        {selected && (
          <span className={`ig-ins-chip is-${selected.status}`}>
            <i />{selected.status === "active" ? "Ativa" : selected.status === "paused" ? "Pausada" : "Rascunho"} · {TRIGGERS[selected.trigger_type] ?? selected.trigger_type}
          </span>
        )}
        <PeriodSwitch value={days} onChange={setDays} />
        <button type="button" className="ig-btn ig-icon-btn" onClick={() => void load()} aria-label="Atualizar" disabled={loading}><RefreshCw size={15} className={loading ? "ig-ins-spin" : ""} /></button>
      </div>

      {error && <div className="ig-ins-error"><AlertTriangle size={15} />{error}</div>}
      {!data && loading && <div className="ig-ins-loading ig-glass">Carregando insights…</div>}
      {data && <InsightsBody data={data} loading={loading} />}
    </div>
  );
}

function InsightsBody({ data, loading }: { data: Insights; loading: boolean }) {
  const { totals } = data;
  const enteredDelta = delta(totals.entered, data.previous.entered);
  const peakHour = totals.entered ? data.hours.indexOf(Math.max(...data.hours)) : -1;

  return (
    <div className={`ig-ins-body${loading ? " is-loading" : ""}`}>
      <section className="ig-ins-kpis">
        <article className="ig-ins-kpi is-hero" style={{ ["--kpi-accent" as string]: "var(--ins-entered)" }}>
          <span className="ig-ins-kpi-label"><Users size={14} />Entraram no fluxo</span>
          <strong>{number(totals.entered)}</strong>
          {enteredDelta ? (
            <small className={`ig-ins-delta is-${enteredDelta.tone}`}>
              {enteredDelta.tone === "up" ? <ArrowUpRight size={13} /> : enteredDelta.tone === "down" ? <ArrowDownRight size={13} /> : null}{enteredDelta.label}
            </small>
          ) : <small className="ig-ins-delta">nos últimos {data.period.days} dias</small>}
          <Sparkline values={data.daily.map(day => day.entered)} />
        </article>
        <article className="ig-ins-kpi" style={{ ["--kpi-accent" as string]: "var(--ins-completed)" }}>
          <span className="ig-ins-kpi-label"><Target size={14} />Concluíram o fluxo</span>
          <div className="ig-ins-kpi-row">
            <Ring value={totals.completionRate} />
            <div><strong>{percent(totals.completionRate)}</strong><small>{number(totals.completed)} de {number(totals.entered)} pessoas</small></div>
          </div>
        </article>
        <article className="ig-ins-kpi" style={{ ["--kpi-accent" as string]: "var(--ins-entered)" }}>
          <span className="ig-ins-kpi-label"><MousePointerClick size={14} />Interagiram</span>
          <strong>{percent(totals.interactionRate)}</strong>
          <small>{number(totals.interacted)} responderam ou tocaram em um botão</small>
        </article>
        <article className="ig-ins-kpi" style={{ ["--kpi-accent" as string]: "#b956df" }}>
          <span className="ig-ins-kpi-label"><Target size={14} />Viraram lead no CRM</span>
          <strong>{number(totals.leads)}</strong>
          <small>{totals.entered ? `${percent(totals.leads / totals.entered)} de quem entrou` : "Adicione um bloco CRM ao fluxo"}</small>
        </article>
      </section>

      <section className="ig-ins-strip">
        <MiniStat icon={<MessageSquareText size={14} />} label="Envios realizados" value={number(totals.messagesSent)} hint="mensagens e respostas" />
        <MiniStat icon={<Clock3 size={14} />} label="Tempo até concluir" value={duration(totals.avgCompletionSeconds)} hint="em média" />
        <MiniStat icon={<Zap size={14} />} label="Em andamento agora" value={number(totals.inProgress)} hint="aguardando resposta ou pausa" />
        <MiniStat icon={<Database size={14} />} label="Deixaram dados" value={number(totals.withData)} hint="WhatsApp, e-mail ou campos" />
        <MiniStat icon={<AlertTriangle size={14} />} label="Com falha" value={number(totals.failed)} hint="erro no envio" tone={totals.failed ? "warn" : undefined} />
      </section>

      <section className="ig-ins-grid">
        <article className="ig-glass ig-ins-panel is-wide">
          <header>
            <div><span className="ig-eyebrow">EVOLUÇÃO</span><h3>Entradas e conclusões por dia</h3></div>
            <div className="ig-ins-legend">
              <span><i style={{ background: "var(--ins-entered)" }} />Entraram</span>
              <span><i style={{ background: "var(--ins-completed)" }} />Concluíram</span>
            </div>
          </header>
          <DailyChart daily={data.daily} />
        </article>

        <article className="ig-glass ig-ins-panel is-fixed">
          <header><div><span className="ig-eyebrow">FUNIL</span><h3>Até onde as pessoas chegam</h3></div><span className="ig-ins-count">{data.funnel.length} etapas</span></header>
          <div className="ig-ins-scroll"><Funnel steps={data.funnel} /></div>
        </article>

        <article className="ig-glass ig-ins-panel is-fixed">
          <header><div><span className="ig-eyebrow">ESCOLHAS</span><h3>Botões mais tocados</h3></div>{data.buttons.length > 0 && <span className="ig-ins-count">{data.buttons.length} botões</span>}</header>
          {data.buttons.length ? (
            <div className="ig-ins-scroll"><ul className="ig-ins-bars">
              {data.buttons.map(button => {
                const max = Math.max(1, ...data.buttons.map(item => item.taps));
                return (
                  <li key={`${button.nodeId}-${button.buttonId}`} title={button.message}>
                    <span className="ig-ins-bar-label">{button.label}<small>{button.message}</small></span>
                    <span className="ig-ins-bar-track"><i style={{ width: `${(button.taps / max) * 100}%` }} /></span>
                    <b>{number(button.taps)}</b>
                  </li>
                );
              })}
            </ul></div>
          ) : <p className="ig-ins-muted">Este fluxo não tem botões de resposta.</p>}
        </article>

        <article className="ig-glass ig-ins-panel">
          <header>
            <div><span className="ig-eyebrow">HORÁRIOS</span><h3>Quando as pessoas chegam</h3></div>
            {peakHour >= 0 && <span className="ig-ins-peak">Pico às {String(peakHour).padStart(2, "0")}h</span>}
          </header>
          <Hours hours={data.hours} peak={peakHour} />
        </article>

        <article className="ig-glass ig-ins-panel">
          <header><div><span className="ig-eyebrow">DADOS</span><h3>Informações coletadas</h3></div></header>
          {data.fields.length ? (
            <ul className="ig-ins-fields">
              {data.fields.map(field => <li key={field.key}><span>{field.label}</span><b>{number(field.count)}</b></li>)}
            </ul>
          ) : <p className="ig-ins-muted">Nenhum dado coletado ainda. Use “Salvar a resposta como” no bloco Aguardar resposta.</p>}
          {data.interruptions.length > 0 && (
            <>
              <h4 className="ig-ins-subtitle">Onde o fluxo foi interrompido</h4>
              <ul className="ig-ins-reasons">
                {data.interruptions.map(item => <li key={item.reason}><AlertTriangle size={13} /><span>{item.reason}</span><b>{number(item.count)}</b></li>)}
              </ul>
            </>
          )}
        </article>

        <article className="ig-glass ig-ins-panel is-wide">
          <header><div><span className="ig-eyebrow">PESSOAS</span><h3>Últimas pessoas no fluxo</h3></div></header>
          {data.recent.length ? (
            <div className="ig-ins-table" role="table">
              <div role="row" className="is-head"><span>Contato</span><span>WhatsApp</span><span>E-mail</span><span>Situação</span><span>Entrou</span></div>
              {data.recent.map(person => (
                <div role="row" key={person.runId}>
                  <span><b>{person.name}</b>{person.username && person.name !== `@${person.username}` ? <small>@{person.username}</small> : null}</span>
                  <span>{phone(person.whatsapp)}</span>
                  <span>{person.email ?? "—"}</span>
                  <span><em className={`ig-ins-status is-${person.status}`}>{STATUS[person.status] ?? person.status}</em>{person.lead && <em className="ig-ins-status is-lead">CRM</em>}</span>
                  <span>{new Date(person.enteredAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              ))}
            </div>
          ) : <p className="ig-ins-muted">Ninguém entrou neste fluxo no período.</p>}
        </article>
      </section>
    </div>
  );
}

/** Period chips with a white highlight that slides to the selected option. */
function PeriodSwitch({ value, onChange }: { value: (typeof PERIODS)[number]; onChange: (days: (typeof PERIODS)[number]) => void }) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const element = buttons.current[PERIODS.indexOf(value)];
      if (element) setPill({ left: element.offsetLeft, width: element.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [value]);
  return (
    <div className="ig-ins-periods" role="radiogroup" aria-label="Período">
      {pill && <span className="ig-ins-periods-pill" aria-hidden="true" style={{ left: pill.left, width: pill.width }} />}
      {PERIODS.map((period, index) => (
        <button key={period} ref={element => { buttons.current[index] = element; }} type="button" role="radio" aria-checked={value === period} onClick={() => onChange(period)}>{period} dias</button>
      ))}
    </div>
  );
}

function MiniStat({ icon, label, value, hint, tone }: { icon: React.ReactNode; label: string; value: string; hint: string; tone?: "warn" }) {
  return (
    <div className={`ig-ins-mini${tone ? ` is-${tone}` : ""}`}>
      <span>{icon}{label}</span>
      <b>{value}</b>
      <small>{hint}</small>
    </div>
  );
}

function useSvgId(prefix: string) {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

/** Completion ring with the platform's light-to-deep gradient stroke. */
export function Ring({ value, size = 56 }: { value: number; size?: number }) {
  const id = useSvgId("ig-ring");
  const stroke = size >= 52 ? 6 : 5;
  const center = size / 2;
  const radius = center - stroke / 2 - 1;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg className="ig-ins-ring" viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={size} y2={size}>
          <stop offset="0%" className="ig-ins-ring-stop-a" />
          <stop offset="100%" className="ig-ins-ring-stop-b" />
        </linearGradient>
      </defs>
      <circle cx={center} cy={center} r={radius} className="ig-ins-ring-track" strokeWidth={stroke} />
      {value > 0 && <circle cx={center} cy={center} r={radius} className="ig-ins-ring-value" stroke={`url(#${id})`} strokeWidth={stroke} strokeDasharray={`${circumference * Math.min(1, value)} ${circumference}`} transform={`rotate(-90 ${center} ${center})`} />}
    </svg>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const width = 120;
  const height = 34;
  const id = useSvgId("ig-spark");
  const points = values.map((value, index) => `${(index / Math.max(1, values.length - 1)) * width},${height - 2 - (value / max) * (height - 6)}`);
  return (
    <svg className="ig-ins-spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className="ig-ins-stop-entered" stopOpacity={0.45} />
          <stop offset="100%" className="ig-ins-stop-entered" stopOpacity={0} />
        </linearGradient>
      </defs>
      <polyline points={`0,${height} ${points.join(" ")} ${width},${height}`} fill={`url(#${id})`} />
      <polyline points={points.join(" ")} className="ig-ins-spark-line" />
    </svg>
  );
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(240, entries[0].contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

function DailyChart({ daily }: { daily: Insights["daily"] }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const enteredId = useSvgId("ig-area-in");
  const completedId = useSvgId("ig-area-done");
  const height = 220;
  const pad = { top: 12, right: 12, bottom: 26, left: 34 };
  const max = niceMax(Math.max(0, ...daily.map(day => Math.max(day.entered, day.completed))));
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const x = (index: number) => pad.left + (daily.length <= 1 ? plotW / 2 : (index / (daily.length - 1)) * plotW);
  const y = (value: number) => pad.top + plotH - (value / max) * plotH;
  const line = (key: "entered" | "completed") => daily.map((day, index) => `${index ? "L" : "M"}${x(index)},${y(day[key])}`).join(" ");
  const area = (key: "entered" | "completed") => `${line(key)} L${x(daily.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max];
  const labelEvery = Math.max(1, Math.ceil(daily.length / Math.max(2, Math.floor(plotW / 64))));
  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const relative = event.clientX - rect.left - pad.left;
    const index = Math.round((relative / Math.max(1, plotW)) * (daily.length - 1));
    setHover(Math.max(0, Math.min(daily.length - 1, index)));
  };
  const hovered = hover === null ? null : daily[hover];
  return (
    <div className="ig-ins-chart" ref={ref}>
      <svg width={width} height={height} onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label="Entradas e conclusões por dia">
        {ticks.map(tick => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} className="ig-ins-grid-line" />
            <text x={pad.left - 8} y={y(tick)} className="ig-ins-axis" textAnchor="end" dominantBaseline="middle">{Math.round(tick)}</text>
          </g>
        ))}
        {daily.map((day, index) => index % labelEvery === 0 || index === daily.length - 1 ? (
          <text key={day.date} x={x(index)} y={height - 8} className="ig-ins-axis" textAnchor="middle">{shortDate(day.date)}</text>
        ) : null)}
        <defs>
          <linearGradient id={enteredId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="ig-ins-stop-entered" stopOpacity={0.42} />
            <stop offset="100%" className="ig-ins-stop-entered" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id={completedId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="ig-ins-stop-completed" stopOpacity={0.3} />
            <stop offset="100%" className="ig-ins-stop-completed" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={area("entered")} fill={`url(#${enteredId})`} />
        <path d={area("completed")} fill={`url(#${completedId})`} />
        <path d={line("entered")} className="ig-ins-line is-entered" />
        <path d={line("completed")} className="ig-ins-line is-completed" />
        {hovered && hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + plotH} className="ig-ins-crosshair" />
            <circle cx={x(hover)} cy={y(hovered.entered)} r={4.5} className="ig-ins-dot is-entered" />
            <circle cx={x(hover)} cy={y(hovered.completed)} r={4.5} className="ig-ins-dot is-completed" />
          </g>
        )}
      </svg>
      {hovered && hover !== null && (
        <div className="ig-ins-tooltip" style={{ left: Math.min(width - 150, Math.max(0, x(hover) + 12)), top: 8 }}>
          <b>{shortDate(hovered.date)}</b>
          <span><i style={{ background: "var(--ins-entered)" }} />Entraram <strong>{hovered.entered}</strong></span>
          <span><i style={{ background: "var(--ins-completed)" }} />Concluíram <strong>{hovered.completed}</strong></span>
        </div>
      )}
    </div>
  );
}

function Funnel({ steps }: { steps: Insights["funnel"] }) {
  const top = Math.max(1, steps[0]?.reached ?? 1);
  return (
    <ol className="ig-ins-funnel">
      {steps.map((step, index) => {
        const share = step.reached / top;
        const previous = index ? steps[index - 1].reached : step.reached;
        const lost = index && previous > step.reached ? previous - step.reached : 0;
        return (
          <li key={step.nodeId} className={`is-${step.type}`}>
            <div className="ig-ins-funnel-head">
              <em className="ig-ins-funnel-step">{index + 1}</em>
              <span><b>{step.title}</b><small>{step.summary}</small></span>
              <span className="ig-ins-funnel-value"><b>{number(step.reached)}</b><small>{percent(share)}</small></span>
            </div>
            <span className="ig-ins-bar-track"><i style={{ width: `${share * 100}%` }} /></span>
            {lost > 0 && <small className="ig-ins-lost">−{number(lost)} pararam antes daqui</small>}
          </li>
        );
      })}
    </ol>
  );
}

function Hours({ hours, peak }: { hours: number[]; peak: number }) {
  const max = Math.max(1, ...hours);
  const total = hours.reduce((sum, value) => sum + value, 0);
  const label = useMemo(() => (hour: number) => `${String(hour).padStart(2, "0")}h`, []);
  if (!total) return <p className="ig-ins-muted">Sem entradas no período.</p>;
  return (
    <div className="ig-ins-hours">
      <div className="ig-ins-hours-bars">
        {hours.map((value, hour) => (
          <span key={hour} className={hour === peak ? "is-peak" : ""} data-tip={`${label(hour)} · ${value} ${value === 1 ? "pessoa" : "pessoas"}`}>
            <i style={{ height: `${Math.max(value ? 6 : 2, (value / max) * 100)}%` }} />
          </span>
        ))}
      </div>
      <div className="ig-ins-hours-axis"><span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>23h</span></div>
    </div>
  );
}
