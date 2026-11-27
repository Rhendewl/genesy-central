"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity, AlertTriangle, CheckCircle2, Clock3, Eye, Flame, Globe2, Info, Lightbulb, ListChecks, Megaphone,
  Monitor, MousePointerClick, Play, Send, Smartphone, Tablet, Target, Timer, TrendingUp, UserRoundX, XCircle,
} from "lucide-react";
import type { FormInsightsPayload } from "@/hooks/useFormularioInsights";
import {
  Card, Delta, Donut, Empty, Glow, Kpi, PillSwitch, TimelineChart, duration, gradient, muted, nf, pctOf, pctText, title,
} from "@/components/insights/kit";
import type { FormReport, ReportGranularity, ReportQuestion, ReportRecommendation, ReportSegment, ReportSummary } from "@/lib/analytics/report";

// ── Rótulos de tempo ──────────────────────────────────────────────────────────

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAYS_LONG = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const WEEKDAYS_AT = ["no domingo", "na segunda", "na terça", "na quarta", "na quinta", "na sexta", "no sábado"];

function axisLabel(key: string, g: ReportGranularity): string {
  if (g === "hour") return `${key.slice(11, 13)}h`;
  if (g === "month") { const [y, m] = key.split("-"); return `${MONTHS[Number(m) - 1]}/${y.slice(2)}`; }
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
}

function tooltipLabel(key: string, g: ReportGranularity): string {
  if (g === "hour") return `${key.slice(8, 10)}/${key.slice(5, 7)} · ${key.slice(11, 13)}h`;
  if (g === "month") { const [y, m] = key.split("-"); return `${MONTHS[Number(m) - 1]} de ${y}`; }
  const date = new Date(`${key}T12:00:00`);
  if (g === "week") return `Semana de ${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;
  return date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}

const deviceIcon = (name: string) => name === "mobile" ? <Smartphone size={13} /> : name === "tablet" ? <Tablet size={13} /> : <Monitor size={13} />;

// ── Peças da página ───────────────────────────────────────────────────────────

/** Funil em degraus: total, fatia do topo e quanto passou da etapa anterior. */
function StageFunnel({ steps }: { steps: Array<{ name: string; value: number; hint?: string }> }) {
  const first = steps[0]?.value ?? 0;
  if (!first) return <Empty text="Sem acessos no período." className="min-h-[220px]" />;
  return <div className="space-y-1.5">
    {steps.map((step, index) => {
      const share = pctOf(step.value, first);
      const fromPrev = index ? pctOf(step.value, steps[index - 1].value) : 100;
      return <div key={step.name}>
        {index > 0 && <p className="flex items-center justify-center gap-1 py-0.5 text-[11px]" style={muted}>↓ {pctText(fromPrev)} avançaram</p>}
        <div className="relative h-12 overflow-hidden rounded-xl" style={{ background: "var(--hover)" }} title={step.hint}>
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 rounded-xl transition-all duration-700" style={{ width: `${Math.max(share, 6)}%`, background: "linear-gradient(90deg, rgba(16,185,129,.75), rgba(110,231,183,.95) 50%, rgba(16,185,129,.75))", opacity: 1 - index * 0.1, boxShadow: "0 6px 24px rgba(16,185,129,.25)" }} />
          <div className="relative flex h-full items-center justify-between px-3 text-xs"><span className="font-medium" style={{ color: "var(--text-subtitle)" }}>{step.name}</span><span className="flex items-baseline gap-2"><strong className="text-base tabular-nums" style={title}>{nf(step.value)}</strong><span className="w-12 text-right tabular-nums" style={muted}>{pctText(share)}</span></span></div>
        </div>
      </div>;
    })}
  </div>;
}

const TONES: Record<ReportRecommendation["tone"], { color: string; icon: ReactNode; label: string }> = {
  critical:  { color: "#f43f5e", icon: <XCircle size={15} />,        label: "Prioridade" },
  attention: { color: "#f59e0b", icon: <AlertTriangle size={15} />,  label: "Atenção" },
  good:      { color: "#10b981", icon: <CheckCircle2 size={15} />,   label: "Destaque" },
  info:      { color: "#38bdf8", icon: <Info size={15} />,           label: "Leitura" },
};

function Recommendations({ items }: { items: ReportRecommendation[] }) {
  if (!items.length) return <Empty text="Nenhum ponto de atenção no período. Continue acompanhando." className="min-h-[90px]" />;
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
    {items.map(item => {
      const tone = TONES[item.tone];
      return <article key={item.id} className="relative overflow-hidden rounded-2xl border p-4" style={{ borderColor: `${tone.color}40`, background: `linear-gradient(160deg, ${tone.color}14, transparent 60%)` }}>
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: tone.color }}>{tone.icon}{tone.label}</div>
        <h3 className="text-sm font-semibold leading-snug" style={title}>{item.title}</h3>
        <p className="mt-1.5 text-xs leading-relaxed" style={muted}>{item.detail}</p>
      </article>;
    })}
  </div>;
}

function rateColor(rate: number, best: number) {
  if (best <= 0) return "#64748b";
  const ratio = rate / best;
  return ratio >= 0.8 ? "#10b981" : ratio >= 0.5 ? "#f59e0b" : "#f43f5e";
}

/** Tabela de conversão por segmento: volume, envios e taxa, com a barra relativa ao melhor. */
function SegmentTable({ rows, empty, firstColumn, iconFor, minVisits = 1 }: { rows: ReportSegment[]; empty: string; firstColumn: string; iconFor?: (key: string) => ReactNode; minVisits?: number }) {
  if (!rows.length) return <Empty text={empty} />;
  const best = Math.max(...rows.filter(r => r.visits >= minVisits).map(r => r.conversionRate), 0);
  return <div className="-mx-1 overflow-x-auto">
    <table className="w-full min-w-[420px] text-left text-xs">
      <thead><tr className="text-[11px]" style={muted}>
        <th className="px-1 pb-2 font-medium">{firstColumn}</th>
        <th className="px-2 pb-2 text-right font-medium">Acessos</th>
        <th className="px-2 pb-2 text-right font-medium">Envios</th>
        <th className="w-[38%] px-1 pb-2 font-medium">Conversão</th>
      </tr></thead>
      <tbody>
        {rows.map((row, index) => {
          const color = row.visits >= minVisits ? rateColor(row.conversionRate, best) : "#64748b";
          return <tr key={row.key} className="border-t" style={{ borderColor: "var(--border)" }}>
            <td className="max-w-[220px] px-1 py-2.5">
              <span className="flex min-w-0 items-center gap-2" style={{ color: "var(--text-subtitle)" }}>
                {iconFor ? <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-white" style={{ background: gradient(index, 135) }}>{iconFor(row.key)}</span> : <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: gradient(index, 135) }} />}
                <span className="truncate" title={row.label}>{row.label}</span>
              </span>
              <span className="ml-[18px] text-[10px]" style={{ color: "var(--text-muted)" }}>{pctText(row.share)} dos acessos</span>
            </td>
            <td className="px-2 py-2.5 text-right tabular-nums" style={title}>{nf(row.visits)}</td>
            <td className="px-2 py-2.5 text-right font-semibold tabular-nums" style={title}>{nf(row.completed)}</td>
            <td className="px-1 py-2.5">
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 rounded-full" style={{ background: "var(--hover)" }}><div className="h-2 rounded-full transition-all duration-700" style={{ width: `${best ? Math.max(3, (row.conversionRate / best) * 100) : 0}%`, background: `linear-gradient(90deg, ${color}99, ${color})` }} /></div>
                <strong className="w-12 text-right tabular-nums" style={{ color: row.completed ? color : "var(--text-muted)" }}>{pctText(row.conversionRate)}</strong>
              </div>
            </td>
          </tr>;
        })}
      </tbody>
    </table>
    {minVisits > 1 && <p className="mt-2 text-[10px]" style={{ color: "var(--text-muted)" }}>As cores comparam com o melhor resultado entre itens com pelo menos {minVisits} acessos.</p>}
  </div>;
}

/** Pergunta por pergunta: quantos chegaram, onde param e quanto tempo levam. */
function QuestionBreakdown({ questions, started, hasTiming }: { questions: ReportQuestion[]; started: number; hasTiming: boolean }) {
  if (!questions.length) return <Empty text="Este formulário não tem perguntas para medir." />;
  const worst = [...questions].sort((a, b) => b.droppedHere - a.droppedHere)[0];
  return <div className="space-y-2">
    <div className="hidden grid-cols-[minmax(0,1fr)_110px_120px_90px] gap-3 px-3 text-[11px] md:grid" style={muted}>
      <span>Pergunta · quem respondeu (sobre quem iniciou)</span><span className="text-right">Pararam aqui</span><span className="text-right">Tempo (mediana)</span><span className="text-right">Trocas</span>
    </div>
    {questions.map(q => {
      const reach = pctOf(q.answered, started);
      const isWorst = worst && worst.stepId === q.stepId && q.droppedHere > 0;
      const dropColor = q.dropRate >= 35 ? "#f43f5e" : q.dropRate >= 15 ? "#f59e0b" : "#10b981";
      return <div key={q.stepId} className="grid gap-3 rounded-xl border p-3 md:grid-cols-[minmax(0,1fr)_110px_120px_90px] md:items-center" style={{ borderColor: isWorst ? "rgba(244,63,94,.45)" : "var(--border)", background: isWorst ? "rgba(244,63,94,.06)" : "transparent" }}>
        <div className="min-w-0">
          <div className="flex items-start gap-2">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[11px] font-semibold" style={{ background: "var(--hover)", color: "var(--text-subtitle)" }}>{q.index + 1}</span>
            <p className="min-w-0 flex-1 text-sm font-medium leading-snug [overflow-wrap:anywhere]" style={title}>{q.title}{isWorst && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 align-middle text-[10px] font-semibold text-rose-400"><Flame size={11} />maior perda</span>}</p>
          </div>
          <div className="ml-8 mt-2 flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full" style={{ background: "var(--hover)" }}><div className="h-2 rounded-full transition-all duration-700" style={{ width: `${Math.max(2, Math.min(100, reach))}%`, background: "linear-gradient(90deg, #0284c7, #7dd3fc)" }} /></div>
            <span className="w-24 text-right text-[11px] tabular-nums" style={muted}><strong style={title}>{nf(q.answered)}</strong> · {pctText(reach)}</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 md:block md:text-right">
          <span className="text-[11px] md:hidden" style={muted}>Pararam aqui</span>
          <span><strong className="text-sm tabular-nums" style={title}>{nf(q.droppedHere)}</strong> <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: `${dropColor}1a`, color: dropColor }}>{pctText(q.dropRate)}</span></span>
        </div>
        <div className="flex items-center justify-between gap-2 md:block md:text-right">
          <span className="text-[11px] md:hidden" style={muted}>Tempo (mediana)</span>
          <strong className="text-sm tabular-nums" style={q.medianSecs === null ? { color: "var(--text-muted)" } : title}>{q.medianSecs === null ? (hasTiming ? "—" : "em coleta") : duration(q.medianSecs)}</strong>
        </div>
        <div className="flex items-center justify-between gap-2 md:block md:text-right">
          <span className="text-[11px] md:hidden" style={muted}>Trocas de resposta</span>
          <strong className="text-sm tabular-nums" style={title}>{nf(q.answerChanges)}</strong>
        </div>
      </div>;
    })}
    <p className="pt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>“Pararam aqui” conta quem iniciou, não concluiu e respondeu até a pergunta anterior. Em formulários com lógica de pulo, perguntas puladas aparecem com menos respostas sem que isso seja abandono.</p>
  </div>;
}

/** Dia da semana × hora (horário de João Pessoa). */
function Heatmap({ report }: { report: FormReport }) {
  const [metric, setMetric] = useState<"visits" | "completed">("visits");
  const grid = useMemo(() => {
    const cells = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ visits: 0, completed: 0 })));
    for (const c of report.heatmap) cells[c.weekday][c.hour] = { visits: c.visits, completed: c.completed };
    return cells;
  }, [report.heatmap]);
  const max = Math.max(1, ...grid.flat().map(c => c[metric]));
  const color = metric === "visits" ? "16,185,129" : "251,191,36";
  const byHour = Array.from({ length: 24 }, (_, h) => grid.reduce((acc, row) => ({ visits: acc.visits + row[h].visits, completed: acc.completed + row[h].completed }), { visits: 0, completed: 0 }));
  const byDay = grid.map(row => row.reduce((acc, c) => ({ visits: acc.visits + c.visits, completed: acc.completed + c.completed }), { visits: 0, completed: 0 }));
  const topHours = byHour.map((v, h) => ({ h, ...v })).filter(v => v[metric] > 0).sort((a, b) => b[metric] - a[metric]).slice(0, 3);
  const topDay = byDay.map((v, d) => ({ d, ...v })).sort((a, b) => b[metric] - a[metric])[0];
  if (!report.heatmap.length) return <Empty text="Sem acessos no período." />;
  return <div>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <PillSwitch label="Métrica do mapa" value={metric} onChange={setMetric} options={[{ value: "visits", text: "Acessos" }, { value: "completed", text: "Envios" }]} />
      <p className="text-xs" style={muted}>
        {topDay && topDay[metric] > 0 && <>Pico <strong style={title}>{WEEKDAYS_AT[topDay.d]}</strong>{topHours.length ? <> · melhores horários: <strong style={title}>{topHours.map(t => `${t.h}h`).join(", ")}</strong></> : null}</>}
      </p>
    </div>
    <div className="overflow-x-auto pb-1">
      <div className="min-w-[640px]">
        <div className="grid grid-cols-[36px_repeat(24,minmax(0,1fr))] gap-[3px]">
          <span />
          {Array.from({ length: 24 }, (_, h) => <span key={h} className="text-center text-[9px] tabular-nums" style={{ color: "var(--text-muted)" }}>{h % 3 === 0 ? `${h}h` : ""}</span>)}
          {grid.map((row, d) => <div key={d} className="contents">
            <span className="self-center text-[10px] font-medium" style={muted}>{WEEKDAYS[d]}</span>
            {row.map((cell, h) => {
              const value = cell[metric];
              const alpha = value ? 0.15 + (value / max) * 0.85 : 0;
              return <span key={h} title={`${WEEKDAYS_LONG[d]}, ${h}h · ${nf(cell.visits)} acessos · ${nf(cell.completed)} envios${cell.visits ? ` · ${pctText(pctOf(cell.completed, cell.visits))} de conversão` : ""}`}
                className="aspect-square rounded-[5px] transition-transform hover:scale-110" style={{ background: value ? `rgba(${color},${alpha})` : "var(--hover)" }} />;
            })}
          </div>)}
        </div>
      </div>
    </div>
    <p className="mt-2 text-[11px]" style={{ color: "var(--text-muted)" }}>Horário de João Pessoa (UTC−3). Passe o mouse em um quadrado para ver acessos, envios e conversão.</p>
  </div>;
}

// ── Navegação por seções ──────────────────────────────────────────────────────

const SECTIONS = [
  { id: "visao-geral", label: "Visão geral", icon: <Activity size={14} /> },
  { id: "perguntas",   label: "Perguntas",   icon: <ListChecks size={14} /> },
  { id: "origens",     label: "Origens e campanhas", icon: <Megaphone size={14} /> },
  { id: "publico",     label: "Dispositivos e horários", icon: <Clock3 size={14} /> },
];

function SectionNav() {
  const [active, setActive] = useState(SECTIONS[0].id);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setActive(visible.target.id);
    }, { rootMargin: "-20% 0px -70% 0px" });
    SECTIONS.forEach(s => { const el = document.getElementById(s.id); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);
  return <nav aria-label="Seções dos insights" className="sticky top-0 z-20 -mx-4 overflow-x-auto px-4 py-2 backdrop-blur-xl sm:-mx-6 sm:px-6" style={{ background: "color-mix(in srgb, var(--background) 78%, transparent)" }}>
    <div className="flex w-max gap-1.5">
      {SECTIONS.map(s => <a key={s.id} href={`#${s.id}`} onClick={() => setActive(s.id)} aria-current={active === s.id ? "true" : undefined}
        className={`flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 text-xs font-semibold transition ${active === s.id ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400" : "hover:bg-white/5"}`}
        style={active === s.id ? undefined : { borderColor: "var(--border-card-hover)", color: "var(--text-subtitle)" }}>{s.icon}{s.label}</a>)}
    </div>
  </nav>;
}

function SectionTitle({ id, eyebrow, heading, detail }: { id: string; eyebrow: string; heading: string; detail?: string }) {
  return <header id={id} className="scroll-mt-16 pt-2">
    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-400">{eyebrow}</p>
    <h2 className="mt-1 text-lg font-semibold tracking-tight sm:text-xl" style={title}>{heading}</h2>
    {detail && <p className="mt-1 text-xs" style={muted}>{detail}</p>}
  </header>;
}


export function Skeletons() {
  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="lc-card h-[150px] animate-pulse" />)}</div>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]"><div className="lc-card h-80 animate-pulse" /><div className="lc-card h-80 animate-pulse" /></div>
  </div>;
}

/** Painel de Insights do formulário — recebe o relatório pronto da API. */
export function FormInsightsDashboard({ data }: { data: FormInsightsPayload }) {
  const report = data.report;
  const prev: ReportSummary | null = data.previous ?? null;
  const s = report.summary;
  const g = data.granularity ?? "day";
  const spark = (key: "visits" | "started" | "completed") => report.timeline.map(p => p[key]);
  const timelineRows = useMemo(() => report.timeline.map(p => ({ ...p, rate: p.visits ? Math.round((p.completed / p.visits) * 1000) / 10 : 0 })), [report]);

  return <div className="flex flex-col gap-5">
          <SectionNav />

          {/* Status */}
          <div className="relative flex flex-wrap items-center gap-3 overflow-hidden rounded-2xl border p-3 pl-3.5 backdrop-blur-xl" style={{ background: "var(--glass-bg)", borderColor: "var(--glass-border)", boxShadow: "var(--glass-shadow)" }}>
            <Glow spots={[{ color: "#10b981", className: "-left-24 -top-32 h-72 w-72", opacity: 0.18 }]} />
            <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: "linear-gradient(135deg, #059669, #10b981 55%, #34d399)" }}><Target size={18} /></span>
            <div className="relative min-w-[200px] flex-1">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold">
                {s.visits
                  ? <><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span><span className="text-emerald-400">Recebendo acessos</span></>
                  : <><span className="h-2 w-2 rounded-full bg-amber-400" /><span className="text-amber-400">Sem acessos neste período</span></>}
              </p>
              <p className="mt-0.5 text-sm" style={title}>
                <strong className="text-base">{pctText(s.conversionRate)}</strong> dos acessos viraram envio · <strong>{nf(s.completed)}</strong> {s.completed === 1 ? "envio" : "envios"} de <strong>{nf(s.visits)}</strong> {s.visits === 1 ? "acesso" : "acessos"}
              </p>
            </div>
            {!report.hasStepTiming && <p className="relative flex max-w-md items-start gap-2 rounded-xl border px-3 py-2 text-[11px] leading-snug" style={{ borderColor: "rgba(56,189,248,.35)", background: "rgba(56,189,248,.07)", color: "var(--text-subtitle)" }}><Info size={13} className="mt-0.5 shrink-0 text-sky-400" />O tempo por pergunta e as trocas de resposta começam a ser medidos a partir de agora. As demais métricas já usam todo o histórico.</p>}
          </div>

          {/* ── Visão geral ── */}
          <SectionTitle id="visao-geral" eyebrow="Visão geral" heading="Quantos chegam, quantos começam e quantos enviam" detail={prev ? "As variações comparam com o período anterior de mesmo tamanho." : undefined} />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi icon={<Eye size={16} />} name="Acessos" value={nf(s.visits)} detail="aberturas do formulário" delta={<Delta current={s.visits} previous={prev?.visits} />} spark={spark("visits")} color="#34d399" />
            <Kpi icon={<Play size={16} />} name="Iniciaram" value={nf(s.started)} detail={`${pctText(s.startRate)} dos acessos`} delta={<Delta current={s.startRate} previous={prev?.startRate} points />} spark={spark("started")} color="#38bdf8" />
            <Kpi icon={<Send size={16} />} name="Envios (leads)" value={nf(s.completed)} detail="formulários concluídos" delta={<Delta current={s.completed} previous={prev?.completed} />} spark={spark("completed")} color="#fbbf24" />
            <Kpi icon={<TrendingUp size={16} />} name="Conversão" value={pctText(s.conversionRate)} detail="acessos que viraram envio" delta={<Delta current={s.conversionRate} previous={prev?.conversionRate} points />} color="#a78bfa" />
            <Kpi icon={<CheckCircle2 size={16} />} name="Taxa de conclusão" value={pctText(s.completionRate)} detail="de quem iniciou, quantos enviaram" delta={<Delta current={s.completionRate} previous={prev?.completionRate} points />} color="#10b981" />
            <Kpi icon={<UserRoundX size={16} />} name="Saíram sem responder" value={pctText(s.bounceRate)} detail={`${nf(s.visits - s.started)} acessos sem nenhuma resposta`} delta={<Delta current={s.bounceRate} previous={prev?.bounceRate} points inverse />} color="#f43f5e" />
            <Kpi icon={<Timer size={16} />} name="Tempo até enviar" value={duration(s.medianCompletionSecs)} detail={s.avgCompletionSecs ? `mediana · média ${duration(s.avgCompletionSecs)}` : "mediana de quem concluiu"} delta={<Delta current={s.medianCompletionSecs} previous={prev?.medianCompletionSecs} inverse />} color="#2dd4bf" />
            <Kpi icon={<Clock3 size={16} />} name="Tempo de tela" value={duration(s.avgScreenSecs)} detail={s.avgProgressPct !== null ? `média por acesso ativo · ${pctText(s.avgProgressPct)} do formulário percorrido` : "média por acesso ativo"} color="#f472b6" />
          </div>
          {s.partialLeads > 0 && <div className="flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 text-xs" style={{ borderColor: "rgba(251,191,36,.35)", background: "rgba(251,191,36,.07)", color: "var(--text-subtitle)" }}>
            <MousePointerClick size={15} className="shrink-0 text-amber-400" />
            <span><strong className="text-amber-400">{nf(s.partialLeads)} {s.partialLeads === 1 ? "pessoa começou" : "pessoas começaram"} e não enviou</strong>, mas deixaram respostas guardadas. Elas aparecem como parciais em Respostas — um bom público para remarketing ou contato.</span>
          </div>}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Card heading="Evolução no período" subtitle="Toque nas legendas para mostrar ou esconder; passe o mouse para ver o detalhe." icon={<TrendingUp size={16} />}>
              {timelineRows.some(p => p.visits)
                ? <TimelineChart rows={timelineRows} defaultHidden={["rate"]} labelFor={key => axisLabel(key, g)} tooltipFor={key => tooltipLabel(key, g)} series={[
                    { key: "visits", name: "Acessos", color: "#34d399", kind: "bar" },
                    { key: "started", name: "Iniciaram", color: "#38bdf8", kind: "bar" },
                    { key: "completed", name: "Envios", color: "#fbbf24", kind: "line" },
                    { key: "rate", name: "Conversão", color: "#a78bfa", kind: "line", axis: "right", format: v => pctText(v) },
                  ]} />
                : <Empty text="Sem acessos no período selecionado." className="min-h-[260px]" />}
            </Card>
            <Card heading="Funil do formulário" subtitle="Do acesso até o envio" icon={<Target size={16} />}>
              <StageFunnel steps={[{ name: "Acessaram", value: s.visits }, { name: "Iniciaram", value: s.started, hint: "Responderam ao menos uma pergunta ou clicaram em começar" }, { name: "Enviaram", value: s.completed }]} />
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl p-3" style={{ background: "var(--hover)" }}><p style={muted}>Abandono após iniciar</p><strong className="text-lg tabular-nums" style={title}>{pctText(s.abandonRate)}</strong></div>
                <div className="rounded-xl p-3" style={{ background: "var(--hover)" }}><p style={muted}>{s.avgScore !== null ? "Pontuação média" : "Formulário percorrido"}</p><strong className="text-lg tabular-nums" style={title}>{s.avgScore !== null ? nf(s.avgScore) : s.avgProgressPct !== null ? pctText(s.avgProgressPct) : "—"}</strong></div>
              </div>
            </Card>
          </div>

          <Card heading="Leitura rápida" subtitle="O que os números dizem e por onde começar a otimizar" icon={<Lightbulb size={16} />} iconColor="#fbbf24">
            <Recommendations items={data.recommendations ?? []} />
          </Card>

          {/* ── Perguntas ── */}
          <SectionTitle id="perguntas" eyebrow="Perguntas" heading="Onde as pessoas param" detail="Quem respondeu cada pergunta, quem parou nela e quanto tempo levou." />
          <Card heading="Pergunta por pergunta" subtitle={`${nf(s.started)} ${s.started === 1 ? "pessoa iniciou" : "pessoas iniciaram"} no período`} icon={<ListChecks size={16} />} iconColor="#38bdf8">
            <QuestionBreakdown questions={report.questions} started={s.started} hasTiming={report.hasStepTiming} />
          </Card>

          {/* ── Origens ── */}
          <SectionTitle id="origens" eyebrow="Origens e campanhas" heading="De onde vêm os acessos — e quais convertem" detail="Pela UTM do link; sem UTM, pelo site ou app de onde a pessoa veio." />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <Card heading="Origem dos acessos" subtitle="Participação de cada canal" icon={<Globe2 size={16} />}>
              <Donut rows={report.sources.map(r => ({ name: r.key, label: r.label, value: r.visits }))} unit="acessos" />
            </Card>
            <Card heading="Conversão por origem" subtitle="Acessos, envios e taxa de cada canal" icon={<TrendingUp size={16} />} iconColor="#a78bfa">
              <SegmentTable rows={report.sources} firstColumn="Origem" empty="Sem acessos no período." minVisits={10} />
            </Card>
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            <Card heading="Tipo de tráfego" subtitle="Anúncio, alcance orgânico ou acesso direto" icon={<Megaphone size={16} />} iconColor="#fbbf24">
              <SegmentTable rows={report.trafficTypes} firstColumn="Tipo" empty="Sem acessos no período." />
            </Card>
            <Card heading="Campanhas" subtitle="Pelo utm_campaign do link" icon={<Megaphone size={16} />} iconColor="#38bdf8" className="xl:col-span-2">
              <SegmentTable rows={report.campaigns} firstColumn="Campanha" empty="Nenhum acesso com campanha (UTM) no período." minVisits={5} />
            </Card>
          </div>
          {report.contents.length > 0 && <Card heading="Criativos e anúncios" subtitle="Pelo utm_content do link — compare qual peça traz mais envios" icon={<Eye size={16} />} iconColor="#f472b6">
            <SegmentTable rows={report.contents} firstColumn="Criativo" empty="" minVisits={5} />
          </Card>}

          {/* ── Público ── */}
          <SectionTitle id="publico" eyebrow="Dispositivos e horários" heading="Como e quando as pessoas respondem" />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <Card heading="Dispositivos" subtitle="Acessos e conversão por aparelho" icon={<Smartphone size={16} />}>
              <Donut rows={report.devices.map(r => ({ name: r.key, label: r.label, value: r.visits }))} unit="acessos" iconFor={deviceIcon} />
              <div className="mt-5"><SegmentTable rows={report.devices} firstColumn="Aparelho" iconFor={deviceIcon} empty="Sem acessos no período." /></div>
            </Card>
            <Card heading="Mapa de horários" subtitle="Quando chegam os acessos e os envios" icon={<Clock3 size={16} />} iconColor="#fbbf24">
              <Heatmap report={report} />
              {report.browsers.length > 0 && <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                <p className="mb-2 text-xs font-semibold" style={title}>Navegadores</p>
                <div className="flex flex-wrap gap-2">{report.browsers.map((b, i) => <span key={b.key} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px]" style={{ background: "var(--hover)", color: "var(--text-subtitle)" }}><span className="h-2 w-2 rounded-full" style={{ background: gradient(i, 135) }} />{b.label} <strong style={title}>{pctText(b.share)}</strong> · conv. {pctText(b.conversionRate)}</span>)}</div>
              </div>}
            </Card>
          </div>
  </div>;
}
