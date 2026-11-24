"use client";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { useSegmentIndicator } from "@/components/ui/useSegmentIndicator";
import { Clock3, ArrowRight, RefreshCw, Info, ChevronDown, Users, Timer, CheckCircle2, CircleAlert, ArrowUpRight, BarChart3, Moon, Sun } from "lucide-react";
import type { Lead } from "@/types";
import type { TimingStage, TimingEvent } from "@/lib/crm/operation-analytics";
import { analyzeOperation, crmDate, CRM_TIME_ZONE, durationLabel, summarizeDurations } from "@/lib/crm/operation-analytics";
import { MobileFilterDisclosure } from "./MobileFilterDisclosure";
import "./crm-mobile.css";
import { AnalyticsPeriodPicker } from "./AnalyticsPeriodPicker";
import { useUsers } from "@/hooks/useUsers";
import "./crm-analysis.css";

type TimeMetric = "average" | "median" | "p90";
const metricLabels: Record<TimeMetric, string> = { average: "Média", median: "Mediana", p90: "P90" };
const panel = "crm-analysis-panel";
const SLA_OPTIONS = [5, 15, 30, 60, 120, 240, 1440];
const SLA_STORAGE_KEY = "genesy:crm-analysis:sla";
const DEFAULT_SLA = 5;

/** Hora (0–23) da chegada no fuso do CRM. */
const arrivalHour = new Intl.DateTimeFormat("en-US", { timeZone: CRM_TIME_ZONE, hour: "numeric", hourCycle: "h23" });
/** Noite: das 18h às 5h59. Dia: das 6h às 17h59. */
const isNightHour = (hour: number) => hour >= 18 || hour < 6;

/** Rosca de chegadas à noite (azul) e de dia (amarelo). */
function DayNightDonut({ night, day }: { night: number; day: number }) {
  const uid = useId().replace(/:/g, "");
  const total = night + day;
  const radius = 44, circumference = 2 * Math.PI * radius;
  const nightLength = total ? (night / total) * circumference : 0;
  const gap = night && day ? 3 : 0;
  const nightPct = total ? Math.round((night / total) * 100) : 0;
  const dominant = !total ? null : night === day ? "tie" : night > day ? "night" : "day";
  return <div className="relative h-32 w-32 shrink-0">
    <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-n`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="120" y2="120"><stop offset="0%" stopColor="#93c5fd" /><stop offset="100%" stopColor="#2563eb" /></linearGradient>
        <linearGradient id={`${uid}-d`} gradientUnits="userSpaceOnUse" x1="0" y1="120" x2="120" y2="0"><stop offset="0%" stopColor="#fde68a" /><stop offset="100%" stopColor="#f59e0b" /></linearGradient>
      </defs>
      <circle cx={60} cy={60} r={radius} fill="none" stroke="var(--border)" strokeWidth={13} />
      {night > 0 && <circle cx={60} cy={60} r={radius} fill="none" stroke={`url(#${uid}-n)`} strokeWidth={13} strokeLinecap={day ? "round" : "butt"} strokeDasharray={`${Math.max(0.01, nightLength - gap)} ${circumference}`} />}
      {day > 0 && <circle cx={60} cy={60} r={radius} fill="none" stroke={`url(#${uid}-d)`} strokeWidth={13} strokeLinecap={night ? "round" : "butt"} strokeDasharray={`${Math.max(0.01, circumference - nightLength - gap)} ${circumference}`} strokeDashoffset={-nightLength} />}
    </svg>
    <div className="absolute inset-0 grid place-items-center text-center"><div>
      {dominant === "night" ? <Moon size={16} className="mx-auto text-blue-400" /> : dominant === "day" ? <Sun size={16} className="mx-auto text-amber-400" /> : null}
      <strong className="mt-0.5 block text-xl font-semibold tracking-tight">{total ? `${dominant === "day" ? 100 - nightPct : nightPct}%` : "—"}</strong>
      <span className="text-[10px] text-[var(--muted-foreground)]">{dominant === "day" ? "de dia" : dominant === "night" ? "à noite" : total ? "metade" : "sem dados"}</span>
    </div></div>
  </div>;
}
export function OperationAnalytics({ leads, history, stages, pipelines, refresh, pipelineFilter }: {
  leads: Lead[]; history: TimingEvent[]; stages: TimingStage[];
  pipelines: { id: string; name: string; color?: string }[]; refresh: () => void; pipelineFilter?: ReactNode;
}) {
  const { profiles } = useUsers();
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const [start, setStart] = useState(() => crmDate(new Date(Date.now() - 29 * 86400000).toISOString()));
  const [end, setEnd] = useState(() => crmDate(new Date().toISOString()));
  const [assignee, setAssignee] = useState("all");
  const [sla, setSla] = useState(DEFAULT_SLA);
  // A meta escolhida fica guardada neste navegador e só muda quando outra opção é selecionada.
  useEffect(() => {
    try { const saved = Number(localStorage.getItem(SLA_STORAGE_KEY)); if (SLA_OPTIONS.includes(saved)) setSla(saved); } catch { /* navegação privada */ }
  }, []);
  const chooseSla = (minutes: number) => { setSla(minutes); try { localStorage.setItem(SLA_STORAGE_KEY, String(minutes)); } catch { /* navegação privada */ } };
  const [metric, setMetric] = useState<TimeMetric>("average");
  const metricSeg = useSegmentIndicator({ background: "var(--background)", boxShadow: "0 1px 5px rgba(0,0,0,.1)" }, { activeSelector: '[aria-pressed="true"]' });
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const cohort = useMemo(() => leads.filter(lead => {
    const day = lead.received_at ? crmDate(lead.received_at) : lead.entered_at;
    return (!start || day >= start) && (!end || day <= end) && (assignee === "all" || (lead.assigned_to ?? "none") === assignee);
  }), [leads, start, end, assignee]);
  const data = useMemo(() => analyzeOperation(cohort, history, stages, now, sla), [cohort, history, stages, now, sla]);
  const stageName = (id: string) => stages.find(stage => stage.id === id)?.name ?? "Etapa removida";
  const pipelineName = (id: string) => pipelines.find(p => p.id === id)?.name ?? "Pipeline";
  const responsible = (id: string | null) => profiles.find(p => p.id === id)?.full_name ?? "Sem responsável";
  const pending = data.timings.filter(t => t.waiting).sort((a, b) => (a.waitingSince ? Date.parse(a.waitingSince) : Infinity) - (b.waitingSince ? Date.parse(b.waitingSince) : Infinity));
  const isTerminal = (stage: TimingStage) => stage.is_won || stage.is_lost || stage.metric_type === "sale" || stage.metric_type === "lost";
  const measuredStages = data.stages.filter(s => !isTerminal(s.stage) && s.completed.count > 0);
  const slowest = [...measuredStages].sort((a, b) => (b.completed[metric] ?? 0) - (a.completed[metric] ?? 0))[0];
  const pipelineIds = Array.from(new Set(data.stages.map(s => s.stage.pipeline_id)));
  const assigneeRows = Array.from(new Set(cohort.map(l => l.assigned_to ?? "none"))).map(id => {
    const rows = data.timings.filter(t => (t.lead.assigned_to ?? "none") === id);
    return { id, rows, stats: summarizeDurations(rows.flatMap(t => t.firstAdvanceMs === null ? [] : [t.firstAdvanceMs])) };
  }).sort((a,b)=>(b.stats.average??-1)-(a.stats.average??-1));
  const routeLabel = data.entryRoutes.length === 1 ? `${data.entryRoutes[0].from.name ?? "Etapa inicial"} → ${data.entryRoutes[0].to?.name ?? "Próxima etapa não configurada"}` : "Etapa inicial → próxima etapa de atendimento";
  const progress = data.withinSla === null ? 0 : Math.max(0, Math.min(100, data.withinSla));
  const arrivals = cohort.flatMap(lead => {
    const time = lead.received_at ? Date.parse(lead.received_at) : NaN;
    return Number.isFinite(time) ? [Number(arrivalHour.format(new Date(time)))] : [];
  });
  const nightCount = arrivals.filter(isNightHour).length;
  const dayCount = arrivals.length - nightCount;
  const pct = (value: number) => arrivals.length ? `${Math.round(value / arrivals.length * 100)}%` : "—";
  const arrivalVerdict = !arrivals.length ? "Sem horários de chegada no período" : nightCount === dayCount ? "Chegadas divididas entre dia e noite" : nightCount > dayCount ? "A maior parte dos leads chega à noite" : "A maior parte dos leads chega de dia";
  return <section className="crm-analysis mb-8 space-y-6 px-4 sm:px-6" aria-label="Análise de tempo e atendimento">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="crm-analysis-eyebrow">Visão da operação</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-title)] sm:text-2xl">Onde o atendimento avança. Onde ele demora.</h2><p className="mt-2 text-sm text-[var(--muted-foreground)]">Veja quanto tempo os leads levam para sair de cada etapa.</p></div><button onClick={() => { setNow(Date.now()); refresh(); }} className="crm-analysis-refresh"><RefreshCw size={15}/>Atualizar análise</button></header>

    <MobileFilterDisclosure summary={`${pipelineIds.length===1?pipelineName(pipelineIds[0]):`${pipelineIds.length} pipelines`} · ${start ? start.slice(5).split("-").reverse().join("/") : "Todo o histórico"}${end ? ` — ${end.slice(5).split("-").reverse().join("/")}` : ""}`} label="Filtros da análise" active={assignee!=="all"}>
    <div className="crm-analysis-toolbar">
      {pipelineFilter && <div className="min-w-0">{pipelineFilter}</div>}
      <AnalyticsPeriodPicker start={start} end={end} onChange={(from,to)=>{setStart(from);setEnd(to);}}/>
      <label className="crm-analysis-filter"><Users size={17} className="shrink-0 text-[var(--muted-foreground)]"/><span className="min-w-0 flex-1"><span className="crm-analysis-filter-label">Responsável</span><select aria-label="Responsável pela análise" value={assignee} onChange={e=>setAssignee(e.target.value)} className="crm-analysis-select"><option value="all">Todos os responsáveis</option><option value="none">Sem responsável</option>{profiles.filter(p=>leads.some(l=>l.assigned_to===p.id)).map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select></span></label>
      <label className="crm-analysis-filter"><Timer size={17} className="shrink-0 text-[var(--muted-foreground)]"/><span className="min-w-0 flex-1"><span className="crm-analysis-filter-label">Meta do primeiro atendimento</span><select aria-label="Meta de primeiro atendimento" value={sla} onChange={e=>chooseSla(Number(e.target.value))} className="crm-analysis-select">{SLA_OPTIONS.map(n=><option key={n} value={n}>{durationLabel(n*60000)}</option>)}</select></span></label>
    </div>

    </MobileFilterDisclosure>

    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--muted-foreground)]"><span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-sky-400"/><strong className="font-semibold text-[var(--text-title)]">{cohort.length} leads</strong> no período selecionado</span><details className="crm-analysis-method"><summary className="inline-flex cursor-pointer items-center gap-1.5"><Info size={13}/>Como os tempos são calculados<ChevronDown size={12}/></summary><p>Consideramos os leads que chegaram no período e seus movimentos até agora. Primeiro atendimento é a primeira saída da etapa inicial para a próxima etapa de atendimento. Com uma pipeline selecionada, o topo e o cartão da etapa inicial usam os mesmos leads, horários e medida. Com várias pipelines, o topo consolida a seleção e cada cartão mostra sua própria pipeline. Descartes, saltos e retornos não alteram esse indicador. Aguardando atendimento inclui todos os leads atualmente na etapa inicial, inclusive os que retornaram. São tempos corridos, incluindo noites e fins de semana. Horário de João Pessoa. A meta é uma referência desta análise.</p></details></div>

    <div className="crm-analysis-summary">
      <article className={`${panel} crm-analysis-hero crm-analysis-feature`}><div className="crm-analysis-card-heading"><span className="crm-analysis-icon text-sky-400"><Timer size={19}/></span><span>Primeiro atendimento</span></div><p className="crm-analysis-big-number">{durationLabel(data.firstContact[metric])}</p><p className="text-xs text-[var(--muted-foreground)]">{routeLabel} · {metricLabels[metric].toLowerCase()}</p><div className="crm-analysis-card-footer"><span>Mediana <strong>{durationLabel(data.firstContact.median)}</strong></span><span>{data.firstContact.count} tempos medidos</span></div></article>
      <article className={`${panel} crm-analysis-feature`}><div className="crm-analysis-card-heading"><span className="crm-analysis-icon text-emerald-400"><CheckCircle2 size={19}/></span><span>Atendidos em até {durationLabel(sla*60000)}</span></div><div className="mt-5 flex items-center justify-between gap-3"><div><p className="text-3xl font-semibold tracking-tight sm:text-4xl">{data.withinSla===null?"—":`${data.withinSla.toFixed(0)}%`}</p><p className="mt-2 text-xs text-[var(--muted-foreground)]">{data.firstContact.count} primeiros atendimentos medidos</p></div><div className="crm-analysis-ring" role="img" aria-label={data.withinSla===null?"Sem tempos de atendimento medidos":`${data.withinSla.toFixed(0)}% atendidos em até ${durationLabel(sla*60000)}`} style={{background:`conic-gradient(#34d399 ${progress*3.6}deg, var(--border) 0deg)`}}><CheckCircle2 size={18} className="relative z-10 text-emerald-400"/></div></div><div className="crm-analysis-card-footer"><span>P90 <strong>{durationLabel(data.firstContact.p90)}</strong></span><span title="90% dos tempos de primeiro atendimento estão abaixo desse valor">90% dos tempos até esse valor</span></div></article>
      <article className={panel}><div className="crm-analysis-card-heading"><span className="crm-analysis-icon text-amber-400"><Users size={19}/></span><span>Aguardando atendimento</span></div><p className="crm-analysis-big-number">{data.waiting}<span className="ml-2 text-sm font-normal text-[var(--muted-foreground)]">leads</span></p><p className="text-xs text-[var(--muted-foreground)]">Leads atualmente na etapa inicial, incluindo retornos</p><div className="crm-analysis-card-footer"><span className={data.overdue?"text-amber-500":""}>{data.overdue>0&&<CircleAlert size={12} className="mr-1 inline"/>}<strong>{data.overdue}</strong> acima da meta</span><span>Meta: {durationLabel(sla*60000)}</span></div></article>
      <article className={`${panel} ${slowest?"crm-analysis-bottleneck":""}`}><div className="crm-analysis-card-heading"><span className="crm-analysis-icon text-violet-400"><BarChart3 size={19}/></span><span>Saída mais demorada</span></div><p className="crm-analysis-big-number">{durationLabel(slowest?.completed[metric]??null)}</p><p className="truncate text-xs text-[var(--muted-foreground)]" title={slowest?.stage.name}>{slowest?.stage.name??"Aguardando saídas registradas"}</p><div className="crm-analysis-card-footer"><span>{metricLabels[metric]} até sair</span><span className="truncate">{slowest?pipelineName(slowest.stage.pipeline_id):"Sem comparação disponível"}</span></div></article>
      <article className={`${panel} crm-analysis-daynight`}><div className="crm-analysis-card-heading"><span className="crm-analysis-icon text-blue-400">{nightCount >= dayCount ? <Moon size={19}/> : <Sun size={19} className="text-amber-400"/>}</span><span>Horário de chegada</span></div><div className="mt-4 flex items-center gap-4"><DayNightDonut night={nightCount} day={dayCount}/><ul className="min-w-0 flex-1 space-y-3 text-xs"><li className="flex items-center justify-between gap-2"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{background:"linear-gradient(135deg,#93c5fd,#2563eb)"}}/>Noite<span className="text-[10px] text-[var(--muted-foreground)]">18h–6h</span></span><span className="tabular-nums"><strong className="text-sm">{pct(nightCount)}</strong> <span className="text-[var(--muted-foreground)]">· {nightCount}</span></span></li><li className="flex items-center justify-between gap-2"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{background:"linear-gradient(135deg,#fde68a,#f59e0b)"}}/>Dia<span className="text-[10px] text-[var(--muted-foreground)]">6h–18h</span></span><span className="tabular-nums"><strong className="text-sm">{pct(dayCount)}</strong> <span className="text-[var(--muted-foreground)]">· {dayCount}</span></span></li></ul></div><div className="crm-analysis-card-footer"><span className="font-medium text-[var(--text-title)]">{arrivalVerdict}</span><span>{arrivals.length} com hora de chegada</span></div></article>
    </div>

    <section className={`${panel} crm-analysis-stage-section`} aria-label="Tempo para sair de cada etapa">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="crm-analysis-eyebrow">Ritmo da pipeline</p><h3 className="mt-1 text-lg font-semibold">Tempo para sair de cada etapa</h3><p className="mt-2 max-w-2xl text-xs leading-relaxed text-[var(--muted-foreground)]">O número em destaque considera as passagens concluídas. Clique em uma etapa para ver os detalhes e os próximos movimentos.</p></div><div ref={metricSeg.trackRef} className="crm-analysis-metric-switch" role="group" aria-label="Medida do tempo de saída">{metricSeg.indicator}{(["average","median","p90"] as const).map(key=><button type="button" key={key} aria-pressed={metric===key} onClick={()=>setMetric(key)}>{metricLabels[key]}</button>)}</div></div>
      {metric==="p90"&&<p className="mt-3 text-xs text-[var(--muted-foreground)]">P90: 90% das passagens concluídas levaram até esse tempo.</p>}
      <div className="mt-6 space-y-7">{pipelineIds.map(pipelineId=>{
        const rows=data.stages.filter(s=>s.stage.pipeline_id===pipelineId);
        const max=Math.max(1,...rows.filter(s=>!isTerminal(s.stage)).map(s=>s.completed[metric]??0));
        return <div key={pipelineId}><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h4 className="flex items-center gap-2 text-sm font-semibold"><span className="h-2 w-2 rounded-full" style={{background:pipelines.find(p=>p.id===pipelineId)?.color??"#38bdf8"}}/>{pipelineName(pipelineId)}</h4><span className="text-xs text-[var(--muted-foreground)]">{cohort.filter(l=>l.pipeline_id===pipelineId).length} leads na seleção</span></div>
          <div className="crm-analysis-stage-grid">{rows.map((row,index)=>{
            const terminal=isTerminal(row.stage),time=row.completed[metric];
            const outgoing=data.transitions.filter(t=>t.from===row.stage.id);
            const bottleneck=!terminal&&slowest?.stage.id===row.stage.id;
            return <div key={row.stage.id} className={`crm-analysis-stage-wrapper ${expandedStage===row.stage.id?"is-expanded":""}`}><button type="button" className={`crm-analysis-stage ${bottleneck?"is-bottleneck":""} ${expandedStage===row.stage.id?"is-selected":""}`} aria-expanded={expandedStage===row.stage.id} aria-controls={`stage-detail-${row.stage.id}`} onClick={()=>setExpandedStage(current=>current===row.stage.id?null:row.stage.id)}>
              <span className="flex items-start justify-between gap-2"><span className="crm-analysis-stage-step">{String(index+1).padStart(2,"0")}</span>{bottleneck?<span className="crm-analysis-slow-badge">Saída mais lenta</span>:<ChevronDown size={14} className={`mt-1 text-[var(--muted-foreground)] ${expandedStage===row.stage.id?"rotate-180":""}`}/>}</span>
              <span className="mt-3 block text-sm font-medium">{row.stage.name||"Etapa"}</span><span className={`mt-4 block font-semibold tracking-tight ${terminal?"text-lg text-[var(--muted-foreground)]":"text-3xl"}`}>{terminal?"Encerramento":durationLabel(time)}</span>
              <span className="mt-1 block text-[11px] text-[var(--muted-foreground)]">{terminal?"Fim desta parte do atendimento":row.completed.count?`${metricLabels[metric].toLowerCase()} para sair da etapa`:"Sem saídas com tempo registrado"}</span>
              <span className="crm-analysis-stage-track" aria-hidden="true"><span style={{width:terminal||time===null?"0%":`${Math.max(2,time/max*100)}%`,background:bottleneck?"#a78bfa":row.stage.color??"#38bdf8"}}/></span>
              <span className="flex items-center justify-between gap-2 text-[11px]"><span><strong>{row.current}</strong> leads agora</span><span className="text-[var(--muted-foreground)]">{row.completed.count} {row.isInitial?"primeiros atendimentos":"saídas"} medidos</span></span>
              {!terminal&&row.open.count>0&&<span className="mt-2 block text-[10px] text-[var(--muted-foreground)]">Quem está aqui já espera {durationLabel(row.open.median)} · mediana</span>}
              <span className="mt-3 flex items-center gap-1 text-[10px] font-medium text-sky-400">{expandedStage===row.stage.id?"Ocultar detalhes":"Ver detalhes da etapa"}<ChevronDown size={12} className={expandedStage===row.stage.id?"rotate-180":""}/></span>
            </button>{expandedStage===row.stage.id&&<div id={`stage-detail-${row.stage.id}`} className="crm-analysis-stage-detail" role="region" aria-label={`Detalhes de ${row.stage.name}`}><div className="flex flex-wrap items-center justify-between gap-3"><h5 className="text-sm font-semibold">{row.stage.name} <span className="font-normal text-[var(--muted-foreground)]">· tempo até sair</span></h5><span className="text-xs text-[var(--muted-foreground)]">{row.completed.count} passagens medidas</span></div>{row.isInitial&&<p className="mt-3 text-xs leading-relaxed text-[var(--muted-foreground)]">Mesmo indicador do primeiro atendimento: {row.stage.name} → {stageName(row.nextStageId??"")}. Uma medida por lead, a partir da chegada original. Retornos e outras saídas ficam fora desse tempo.</p>}<div className="mt-4 grid grid-cols-3 gap-4">{(["average","median","p90"] as const).map(key=><div key={key}><p className="text-[11px] text-[var(--muted-foreground)]">{metricLabels[key]}</p><p className="mt-1 text-xl font-semibold">{durationLabel(row.completed[key])}</p></div>)}</div><div className="mt-4 space-y-2 border-t border-[var(--border)] pt-3"><p className="mb-3 text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Todas as movimentações · inclui retornos e outras saídas</p>{outgoing.map(t=><div key={t.to} className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="inline-flex items-center gap-2"><ArrowRight size={13} className="text-sky-400"/>{stageName(t.to)}</span><span>{durationLabel(t.duration[metric])}<span className="ml-2 text-[var(--muted-foreground)]">· {t.count} movimentos / {t.duration.count} tempos medidos</span></span></div>)}{!outgoing.length&&<p className="text-xs text-[var(--muted-foreground)]">Ainda sem saídas registradas desta etapa.</p>}</div></div>}</div>;
          })}</div>

        </div>;
      })}</div>
      {!data.stages.length&&<div className="crm-analysis-empty"><BarChart3 size={25}/><p>Nenhuma etapa disponível na seleção.</p></div>}
      <p className="mt-5 text-[11px] leading-relaxed text-[var(--muted-foreground)]">Barras comparam os tempos dentro da mesma pipeline. Na etapa inicial, usamos apenas o primeiro atendimento, igual ao indicador do topo. Nas demais etapas, retornos contam como novas passagens. A indicação de saída mais lenta é relativa às etapas com tempos registrados.</p>
    </section>

    <div className="grid gap-5 xl:grid-cols-2"><section className={panel}><div className="flex items-start justify-between gap-3"><div><p className="crm-analysis-eyebrow">Equipe</p><h3 className="mt-1 text-base font-semibold">Ritmo por responsável</h3></div><Users size={18} className="text-[var(--muted-foreground)]"/></div><p className="mt-2 text-xs text-[var(--muted-foreground)]">Tempo médio da etapa inicial para a próxima etapa de atendimento, na primeira passagem.</p><div className="mt-5 space-y-5">{assigneeRows.map(row=>{const max=Math.max(1,...assigneeRows.map(r=>r.stats.average??0));return <div key={row.id}><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="crm-analysis-avatar">{responsible(row.id).split(" ").slice(0,2).map(s=>s[0]).join("")}</span><div className="min-w-0"><p className="truncate text-sm font-medium">{responsible(row.id)}</p><p className="mt-1 text-[11px] text-[var(--muted-foreground)]">{row.rows.length} leads · {row.rows.filter(t=>t.waiting).length} aguardando</p></div></div><p className="shrink-0 text-lg font-semibold">{durationLabel(row.stats.average)}</p></div><div className="ml-12 mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--hover)]"><div className="h-full rounded-full bg-sky-400/70" style={{width:row.stats.average===null?0:`${Math.max(2,row.stats.average/max*100)}%`}}/></div><p className="ml-12 mt-1 text-[10px] text-[var(--muted-foreground)]">{row.stats.count} tempos registrados</p></div>})}{!assigneeRows.length&&<div className="crm-analysis-empty"><Users size={23}/><p>Nenhum lead no período selecionado.</p></div>}</div></section>
      <section className={panel}><div className="flex items-start justify-between gap-3"><div><p className="crm-analysis-eyebrow">Prioridades</p><h3 className="mt-1 text-base font-semibold">Quem precisa de atenção agora</h3></div><span className="crm-analysis-count">{pending.length}</span></div><p className="mt-2 text-xs text-[var(--muted-foreground)]">Todos os leads atualmente na etapa inicial. Em retornos, a espera conta desde a última entrada nessa etapa.</p><div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto">{pending.map(t=>{const wait=t.waitingSince?now-Date.parse(t.waitingSince):null,late=wait!==null&&wait>sla*60000;return <a className={`crm-analysis-priority ${late?"is-overdue":""}`} href={`/crm?lead=${encodeURIComponent(t.lead.id)}`} key={t.lead.id}><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{t.lead.name}</span><span className="mt-1 block truncate text-[11px] text-[var(--muted-foreground)]">{responsible(t.lead.assigned_to)}{t.visits.some(v=>v.stageId===t.lead.stage_id&&v.exitedAt!==null)?" · retornou à etapa inicial":""}</span></span><span className="shrink-0 text-right"><span className="block text-base font-semibold">{durationLabel(wait)}</span><span className={`mt-1 block text-[10px] ${late?"text-amber-500":"text-[var(--muted-foreground)]"}`}>{wait===null?"Hora desconhecida":late?"Acima da meta":"Dentro da meta"}</span></span><ArrowUpRight size={14} className="shrink-0 text-[var(--muted-foreground)]"/></a>})}{!pending.length&&<div className="crm-analysis-empty"><CheckCircle2 size={26} className="text-emerald-400"/><p>Nenhum lead aguardando atendimento na etapa inicial.</p></div>}</div></section></div>

    {data.missingArrival>0&&<details className="crm-analysis-data-note"><summary><Info size={14}/>{data.missingArrival} lead(s) sem hora original de chegada<ChevronDown size={13}/></summary><p>Esses leads aparecem nos volumes. Os cálculos que dependem do horário original usam apenas registros conhecidos; nenhum horário é estimado.</p></details>}
    <details className={`${panel} crm-analysis-audit`}><summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium"><span className="flex items-center gap-2"><Clock3 size={15}/>Consultar todos os tempos em detalhe</span><ChevronDown size={15}/></summary><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[700px] text-left text-xs"><thead className="text-[var(--muted-foreground)]"><tr>{["Pipeline / etapa","Leads agora","Saídas medidas","Média até sair","Mediana até sair","P90 até sair","Espera atual · mediana"].map(h=><th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead><tbody>{data.stages.map(row=><tr key={row.stage.id} className="border-t border-[var(--border)]"><td className="p-3"><span className="text-[var(--muted-foreground)]">{pipelineName(row.stage.pipeline_id)}</span><p className="mt-1 font-medium">{row.stage.name||"Etapa"}</p></td><td className="p-3">{row.current}</td><td className="p-3">{row.completed.count}</td><td className="p-3">{durationLabel(row.completed.average)}</td><td className="p-3">{durationLabel(row.completed.median)}</td><td className="p-3">{durationLabel(row.completed.p90)}</td><td className="p-3">{durationLabel(row.open.median)}</td></tr>)}</tbody></table></div></details>
  </section>;
}
