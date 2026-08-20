"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, CalendarDays, Eye, FileText, FolderOpen, Loader2, Pencil, Plus, Printer, Target, Trash2, TrendingUp, Users, X } from "lucide-react";
import { toast } from "sonner";
import { useAgencyClients } from "@/hooks/useAgencyClients";
import { KpiReadingGuide } from "@/components/insights/KpiReadingGuide";
import {
  COMMERCIAL_PRODUCT_LABELS,
  type CommercialAnalysis,
  type CommercialAnalysisInput,
  type CommercialProductType,
} from "@/types/commercial-analysis";

const integer = new Intl.NumberFormat("pt-BR");
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const tooltipStyle = { background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 12, color: "var(--chart-tooltip-text)" };
const STATUS = { healthy: ["Saudável", "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"], attention: ["Atenção", "text-amber-500 bg-amber-500/10 border-amber-500/20"], critical: ["Crítico", "text-rose-500 bg-rose-500/10 border-rose-500/20"] } as const;

export function CommercialAnalysisModule() {
  const { clients, isLoading: clientsLoading } = useAgencyClients();
  const activeClients = clients.filter((client) => client.status === "ativo");
  const [clientId, setClientId] = useState("");
  const [analyses, setAnalyses] = useState<CommercialAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CommercialAnalysis | null>(null);
  const [viewing, setViewing] = useState<CommercialAnalysis | null>(null);

  useEffect(() => { if (!clientId && activeClients[0]) setClientId(activeClients[0].id); }, [activeClients, clientId]);

  const load = useCallback(async () => {
    if (!clientId) { setAnalyses([]); return; }
    setLoading(true);
    const response = await fetch(`/api/clientes/commercial-analyses?client_id=${clientId}`);
    const json = await response.json() as { analyses?: CommercialAnalysis[]; error?: string };
    if (!response.ok) toast.error(json.error ?? "Não foi possível carregar as análises");
    setAnalyses(json.analyses ?? []);
    setLoading(false);
  }, [clientId]);
  useEffect(() => { void load(); }, [load]);

  const client = activeClients.find((item) => item.id === clientId);
  const latest = analyses[0] ?? null;
  const trend = useMemo(() => [...analyses].reverse().map((item) => ({
    date: format(new Date(`${item.meeting_date}T12:00:00`), "dd/MM"),
    Resposta: item.analysis_snapshot.metrics.responseRate,
    Comparecimento: item.analysis_snapshot.metrics.attendanceRate,
    Fechamento: item.analysis_snapshot.metrics.closingRate,
  })), [analyses]);

  async function remove(item: CommercialAnalysis) {
    if (!window.confirm("Excluir esta análise comercial?")) return;
    const response = await fetch(`/api/clientes/commercial-analyses/${item.id}`, { method: "DELETE" });
    if (!response.ok) return toast.error("Não foi possível excluir");
    toast.success("Análise excluída");
    await load();
  }

  if (clientsLoading) return <div className="grid min-h-72 place-items-center"><Loader2 className="animate-spin text-[var(--primary)]" /></div>;

  return <div className="space-y-5">
    <section className="relative overflow-hidden rounded-3xl border p-5 sm:p-6" style={{ background: "var(--glass-bg-soft)" }}>
      <div className="pointer-events-none absolute -right-20 -top-24 h-60 w-60 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[var(--primary)]">Prontuário comercial</p><h2 className="mt-1 text-lg font-semibold">Análise semanal dos clientes</h2><p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">Registre o funil, gere o diagnóstico e acompanhe se as decisões das reuniões estão melhorando o resultado.</p></div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select value={clientId} onChange={(event) => setClientId(event.target.value)} className="min-h-10 min-w-[240px] rounded-xl border bg-[var(--bg-modal)] px-3 text-sm"><option value="">Selecionar cliente</option>{activeClients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <button disabled={!clientId} onClick={() => { setEditing(null); setFormOpen(true); }} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:opacity-40"><Plus size={15} /> Nova análise</button>
        </div>
      </div>
    </section>

    {!clientId ? <Empty title="Selecione um cliente" text="A pasta comercial será aberta aqui." /> : loading ? <div className="grid min-h-64 place-items-center"><Loader2 className="animate-spin text-[var(--primary)]" /></div> : !latest ? <Empty title={`Pasta de ${client?.name ?? "cliente"}`} text="Nenhuma análise registrada. Crie a primeira reunião comercial para iniciar o histórico." /> : <>
      <div className="flex items-center gap-2"><FolderOpen size={17} className="text-[var(--primary)]" /><div><h2 className="text-sm font-semibold">Pasta comercial · {client?.name}</h2><p className="text-[10px] text-[var(--muted-foreground)]">{analyses.length} análise{analyses.length === 1 ? "" : "s"} armazenada{analyses.length === 1 ? "" : "s"}</p></div></div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Kpi label="Saúde comercial" value={`${latest.analysis_snapshot.score}/100`} sub={STATUS[latest.analysis_snapshot.status][0]} icon={<Target size={15} />} />
        <Kpi label="Leads" value={latest.leads_received} sub={`${latest.leads_no_response} sem resposta`} icon={<Users size={15} />} />
        <Kpi label="Taxa de resposta" value={`${latest.analysis_snapshot.metrics.responseRate}%`} sub={`${latest.leads_responded} respostas`} icon={<TrendingUp size={15} />} />
        <Kpi label="Comparecimento" value={`${latest.analysis_snapshot.metrics.attendanceRate}%`} sub={`${latest.meetings_held}/${latest.meetings_scheduled} reuniões`} icon={<CalendarDays size={15} />} />
        <Kpi label="Vendas" value={latest.sales_closed} sub={`${latest.analysis_snapshot.metrics.closingRate}% das reuniões`} icon={<BarChart3 size={15} />} />
        <Kpi label="Receita" value={money.format(latest.revenue)} sub={`Ticket ${money.format(latest.analysis_snapshot.metrics.averageTicket)}`} icon={<TrendingUp size={15} />} />
      </div>

      <section className="rounded-2xl border p-5" style={{ background: "var(--glass-bg-soft)" }}><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">Diagnóstico executivo</h2><p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">{latest.analysis_snapshot.executiveSummary}</p></div><span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${STATUS[latest.analysis_snapshot.status][1]}`}>{STATUS[latest.analysis_snapshot.status][0]}</span></div></section>

      <KpiReadingGuide title="Onde agir nesta semana" description="Diagnóstico baseado no funil informado na reunião e na comparação com a análise anterior." items={latest.analysis_snapshot.insights} />

      {trend.length > 1 && <section className="rounded-2xl border p-5" style={{ background: "var(--glass-bg-soft)" }}><h2 className="text-sm font-semibold">Evolução comercial</h2><p className="mb-4 text-xs text-[var(--muted-foreground)]">Taxas registradas em cada reunião semanal</p><ResponsiveContainer width="100%" height={290}><AreaChart data={trend}><CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 6" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} unit="%" /><Tooltip contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: 11 }} /><Area type="monotone" dataKey="Resposta" stroke="#3b82f6" fill="#3b82f622" strokeWidth={2} /><Area type="monotone" dataKey="Comparecimento" stroke="#8b5cf6" fill="#8b5cf622" strokeWidth={2} /><Area type="monotone" dataKey="Fechamento" stroke="#10b981" fill="#10b98122" strokeWidth={2} /></AreaChart></ResponsiveContainer></section>}

      <section className="rounded-2xl border p-5" style={{ background: "var(--glass-bg-soft)" }}><h2 className="text-sm font-semibold">Histórico da pasta</h2><p className="mb-4 text-xs text-[var(--muted-foreground)]">Análises, decisões e relatórios das reuniões anteriores</p><div className="space-y-2">{analyses.map((item) => <article key={item.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-500/10 text-blue-500"><FileText size={17} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">Análise de {format(new Date(`${item.meeting_date}T12:00:00`), "dd 'de' MMMM", { locale: ptBR })}</p><span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${STATUS[item.analysis_snapshot.status][1]}`}>{item.analysis_snapshot.score}/100</span></div><p className="mt-0.5 truncate text-[11px] text-[var(--muted-foreground)]">{COMMERCIAL_PRODUCT_LABELS[item.product_type]}{item.development_name ? ` · ${item.development_name}` : ""} · {item.leads_received} leads · {item.sales_closed} vendas</p></div><div className="flex gap-1"><button onClick={() => setViewing(item)} className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs"><Eye size={13} /> Relatório</button><button onClick={() => { setEditing(item); setFormOpen(true); }} className="rounded-lg p-2 hover:bg-[var(--hover)]" title="Editar"><Pencil size={13} /></button><button onClick={() => void remove(item)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-500/10" title="Excluir"><Trash2 size={13} /></button></div></article>)}</div></section>
    </>}

    <AnalysisFormModal open={formOpen} clientId={clientId} analysis={editing} onClose={() => setFormOpen(false)} onSaved={load} />
    {viewing && <AnalysisReport analysis={viewing} clientName={client?.name ?? "Cliente"} onClose={() => setViewing(null)} />}
  </div>;
}

function Kpi({ label, value, sub, icon }: { label: string; value: string | number; sub: string; icon: React.ReactNode }) { return <div className="rounded-2xl border p-4" style={{ background: "var(--glass-bg-soft)" }}><span className="text-[var(--primary)]">{icon}</span><p className="mt-3 text-xl font-semibold">{value}</p><p className="mt-1 text-xs">{label}</p><p className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">{sub}</p></div>; }
function Empty({ title, text }: { title: string; text: string }) { return <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed p-8 text-center"><div><FolderOpen className="mx-auto text-[var(--muted-foreground)]" /><p className="mt-3 text-sm font-medium">{title}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{text}</p></div></div>; }

const numericFields: Array<[keyof CommercialAnalysisInput, string]> = [
  ["leads_received", "Leads recebidos"], ["leads_contacted", "Leads abordados"], ["leads_responded", "Leads que responderam"], ["leads_no_response", "Leads sem resposta"],
  ["qualified_leads", "Leads qualificados"], ["disqualified_leads", "Desqualificados"], ["hot_leads", "Perfil quente"], ["warm_leads", "Perfil morno"], ["cold_leads", "Perfil frio"],
  ["meetings_scheduled", "Reuniões agendadas"], ["meetings_held", "Reuniões realizadas"], ["no_shows", "No-shows"], ["rescheduled_meetings", "Reagendamentos"], ["qualified_meetings", "Reuniões qualificadas"],
  ["proposals_sent", "Propostas apresentadas"], ["sales_closed", "Vendas realizadas"], ["revenue", "Valor vendido (R$)"], ["lost_sales", "Vendas perdidas"],
];

function emptyInput(clientId: string): CommercialAnalysisInput { const today = format(new Date(), "yyyy-MM-dd"); return { client_id: clientId, meeting_date: today, period_start: format(subDays(new Date(), 6), "yyyy-MM-dd"), period_end: today, participants: null, leads_received: 0, leads_contacted: 0, leads_responded: 0, leads_no_response: 0, qualified_leads: 0, disqualified_leads: 0, hot_leads: 0, warm_leads: 0, cold_leads: 0, product_type: "residential_mid", development_name: null, meetings_scheduled: 0, meetings_held: 0, no_shows: 0, rescheduled_meetings: 0, qualified_meetings: 0, proposals_sent: 0, sales_closed: 0, revenue: 0, lost_sales: 0, response_notes: null, lead_profile_notes: null, meeting_notes: null, loss_reasons: null, wins: null, blockers: null, decisions: null, next_actions: null }; }

function AnalysisFormModal({ open, clientId, analysis, onClose, onSaved }: { open: boolean; clientId: string; analysis: CommercialAnalysis | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [data, setData] = useState<CommercialAnalysisInput>(() => emptyInput(clientId)); const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setData(analysis ? Object.fromEntries(Object.keys(emptyInput(clientId)).map((key) => [key, analysis[key as keyof CommercialAnalysis]])) as unknown as CommercialAnalysisInput : emptyInput(clientId)); }, [analysis, clientId, open]);
  if (!open) return null;
  const patch = <K extends keyof CommercialAnalysisInput>(key: K, value: CommercialAnalysisInput[K]) => setData((current) => ({ ...current, [key]: value }));
  async function submit(event: React.FormEvent) { event.preventDefault(); setSaving(true); const response = await fetch(analysis ? `/api/clientes/commercial-analyses/${analysis.id}` : "/api/clientes/commercial-analyses", { method: analysis ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); const json = await response.json() as { error?: string }; setSaving(false); if (!response.ok) return toast.error(json.error ?? "Não foi possível salvar"); toast.success(analysis ? "Análise atualizada" : "Análise e diagnóstico gerados"); onClose(); await onSaved(); }
  return <div className="lc-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-3" style={{ background: "rgba(0,0,0,.68)" }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}><form onSubmit={submit} className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border" style={{ background: "var(--card)" }}><div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="text-sm font-semibold">{analysis ? "Editar análise comercial" : "Nova análise comercial"}</h2><p className="text-[11px] text-[var(--muted-foreground)]">Os indicadores serão calculados e diagnosticados automaticamente.</p></div><button type="button" onClick={onClose}><X size={16} /></button></div><div className="space-y-6 overflow-y-auto p-5">
    <FormSection title="1. Reunião e período"><div className="grid gap-3 sm:grid-cols-4"><Input label="Data da reunião" type="date" value={data.meeting_date} onChange={(v) => patch("meeting_date", v)} /><Input label="Início analisado" type="date" value={data.period_start} onChange={(v) => patch("period_start", v)} /><Input label="Fim analisado" type="date" value={data.period_end} onChange={(v) => patch("period_end", v)} /><Input label="Participantes" value={data.participants ?? ""} onChange={(v) => patch("participants", v || null)} /></div></FormSection>
    <FormSection title="2. Entrada e atendimento"><NumericGrid fields={numericFields.slice(0, 4)} data={data} patch={patch} /><TextArea label="Observações sobre resposta e atendimento" value={data.response_notes} onChange={(v) => patch("response_notes", v)} /></FormSection>
    <FormSection title="3. Perfil dos leads"><div className="grid gap-3 sm:grid-cols-5"><Input label="Qualificados" type="number" value={String(data.qualified_leads)} onChange={(v) => patch("qualified_leads", Number(v))} /><Input label="Desqualificados" type="number" value={String(data.disqualified_leads)} onChange={(v) => patch("disqualified_leads", Number(v))} /><Input label="Quentes" type="number" value={String(data.hot_leads)} onChange={(v) => patch("hot_leads", Number(v))} /><Input label="Mornos" type="number" value={String(data.warm_leads)} onChange={(v) => patch("warm_leads", Number(v))} /><Input label="Frios" type="number" value={String(data.cold_leads)} onChange={(v) => patch("cold_leads", Number(v))} /></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-xs font-medium">Tipologia do produto</span><select value={data.product_type} onChange={(e) => patch("product_type", e.target.value as CommercialProductType)} className="lc-input w-full rounded-lg px-3 py-2 text-sm">{Object.entries(COMMERCIAL_PRODUCT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><Input label="Nome do empreendimento" value={data.development_name ?? ""} onChange={(v) => patch("development_name", v || null)} /></div><TextArea label="Análise qualitativa do perfil dos leads" value={data.lead_profile_notes} onChange={(v) => patch("lead_profile_notes", v)} /></FormSection>
    <FormSection title="4. Reuniões"><NumericGrid fields={numericFields.slice(9, 14)} data={data} patch={patch} /><TextArea label="Observações sobre reuniões, comparecimento e no-shows" value={data.meeting_notes} onChange={(v) => patch("meeting_notes", v)} /></FormSection>
    <FormSection title="5. Vendas"><NumericGrid fields={numericFields.slice(14)} data={data} patch={patch} /><TextArea label="Principais motivos de perda" value={data.loss_reasons} onChange={(v) => patch("loss_reasons", v)} /></FormSection>
    <FormSection title="6. Decisões da reunião"><div className="grid gap-3 sm:grid-cols-2"><TextArea label="O que funcionou" value={data.wins} onChange={(v) => patch("wins", v)} /><TextArea label="Pontos de bloqueio" value={data.blockers} onChange={(v) => patch("blockers", v)} /><TextArea label="Decisões tomadas" value={data.decisions} onChange={(v) => patch("decisions", v)} /><TextArea label="Próximas ações, responsáveis e prazos" value={data.next_actions} onChange={(v) => patch("next_actions", v)} /></div></FormSection>
  </div><div className="flex justify-end gap-2 border-t px-5 py-4"><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-xs">Cancelar</button><button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{saving && <Loader2 size={12} className="animate-spin" />} Salvar e gerar diagnóstico</button></div></form></div>;
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) { return <section><h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">{title}</h3>{children}</section>; }
function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="block"><span className="mb-1.5 block text-xs font-medium">{label}</span><input type={type} min={type === "number" ? 0 : undefined} value={value} onChange={(e) => onChange(e.target.value)} className="lc-input w-full rounded-lg px-3 py-2 text-sm" /></label>; }
function TextArea({ label, value, onChange }: { label: string; value: string | null; onChange: (value: string | null) => void }) { return <label className="mt-3 block"><span className="mb-1.5 block text-xs font-medium">{label}</span><textarea rows={3} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className="lc-input w-full resize-y rounded-lg px-3 py-2 text-sm" /></label>; }
function NumericGrid({ fields, data, patch }: { fields: Array<[keyof CommercialAnalysisInput, string]>; data: CommercialAnalysisInput; patch: <K extends keyof CommercialAnalysisInput>(key: K, value: CommercialAnalysisInput[K]) => void }) { return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{fields.map(([key, label]) => <Input key={key} label={label} type="number" value={String(data[key] ?? 0)} onChange={(value) => patch(key, Number(value))} />)}</div>; }

function AnalysisReport({ analysis, clientName, onClose }: { analysis: CommercialAnalysis; clientName: string; onClose: () => void }) { const m = analysis.analysis_snapshot.metrics; return <div className="lc-modal-backdrop fixed inset-0 z-50 overflow-y-auto bg-black/70 p-3 sm:p-6"><div className="commercial-report mx-auto max-w-4xl rounded-2xl border p-5 sm:p-8" style={{ background: "var(--card)" }}><div className="mb-6 flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[var(--primary)]">Relatório de análise comercial</p><h1 className="mt-1 text-xl font-semibold">{clientName}</h1><p className="mt-1 text-xs text-[var(--muted-foreground)]">Reunião de {format(new Date(`${analysis.meeting_date}T12:00:00`), "dd/MM/yyyy")} · Período {format(new Date(`${analysis.period_start}T12:00:00`), "dd/MM")} a {format(new Date(`${analysis.period_end}T12:00:00`), "dd/MM/yyyy")}</p></div><div className="flex gap-2 print:hidden"><button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs"><Printer size={13} /> Imprimir / PDF</button><button onClick={onClose} className="rounded-lg border p-2"><X size={14} /></button></div></div><div className="rounded-xl border p-4"><p className="text-sm font-semibold">Diagnóstico: {analysis.analysis_snapshot.score}/100</p><p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">{analysis.analysis_snapshot.executiveSummary}</p></div><div className="my-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><ReportMetric label="Leads" value={analysis.leads_received} /><ReportMetric label="Resposta" value={`${m.responseRate}%`} /><ReportMetric label="Comparecimento" value={`${m.attendanceRate}%`} /><ReportMetric label="Conversão em venda" value={`${m.closingRate}%`} /><ReportMetric label="Sem resposta" value={analysis.leads_no_response} /><ReportMetric label="Qualificados" value={analysis.qualified_leads} /><ReportMetric label="Vendas" value={analysis.sales_closed} /><ReportMetric label="Receita" value={money.format(analysis.revenue)} /></div><KpiReadingGuide items={analysis.analysis_snapshot.insights} /><div className="mt-5 grid gap-3 sm:grid-cols-2"><ReportText title="Perfil e empreendimento" text={`${COMMERCIAL_PRODUCT_LABELS[analysis.product_type]}${analysis.development_name ? ` · ${analysis.development_name}` : ""}\n${analysis.lead_profile_notes ?? "Sem observações."}`} /><ReportText title="Pontos positivos" text={analysis.wins} /><ReportText title="Bloqueios" text={analysis.blockers} /><ReportText title="Decisões" text={analysis.decisions} /><ReportText title="Próximas ações" text={analysis.next_actions} /><ReportText title="Motivos de perda" text={analysis.loss_reasons} /></div></div></div>; }
function ReportMetric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl bg-[var(--hover)] p-3"><p className="text-lg font-semibold">{value}</p><p className="text-[10px] text-[var(--muted-foreground)]">{label}</p></div>; }
function ReportText({ title, text }: { title: string; text: string | null }) { return <div className="rounded-xl border p-4"><h3 className="text-xs font-semibold">{title}</h3><p className="mt-2 whitespace-pre-line text-xs leading-5 text-[var(--muted-foreground)]">{text || "Não informado."}</p></div>; }
