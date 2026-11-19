"use client";

import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Clock3, Eye, RefreshCw, Settings2, TrendingUp, UserRound, Users } from "lucide-react";
import { toast } from "sonner";

type Overview = {
  summary: { sessions: number; visitors: number; views: number; avg_seconds: number; leads: number; conversion_rate: number };
  timeline: Array<{ date: string; sessions: number; views: number; leads: number }>;
  sections: Array<{ name: string; value: number }>;
  sources?: Array<{ name: string; value: number }>;
  campaigns?: Array<{ name: string; value: number }>;
  devices?: Array<{ name: string; value: number }>;
  clicks?: Array<{ name: string; value: number }>;
  funnel?: Array<{ name: string; value: number }>;
  whatsapp_clicks?: number;
  leads: Array<{ id: string; name: string; phone: string; profile: string | null; monthly_vgv: string | null; sync_status: string; sync_error: string | null; crm_lead_id: string | null; created_at: string }>;
};
type Pipeline = { id: string; name: string; crm_stages: Array<{ id: string; name: string; order_index: number; is_active: boolean }> };
type SettingsPayload = { settings: { crm_pipeline_id: string | null; crm_stage_id: string | null; deal_value?: number | string | null } | null; pipelines: Pipeline[]; canManage: boolean };

const LABELS: Record<string, string> = { direto: "Direto", instagram: "Instagram", facebook: "Facebook", google: "Google", mobile: "Celular", desktop: "Computador", tablet: "Tablet", desconhecido: "Não identificado", top: "Topo", numeros: "Números", depoimentos: "Depoimentos", sistema: "Sistema Genesy", faq: "FAQ", cta: "Formulário" };
const label = (name: string) => LABELS[name] ?? name;
function Ranking({ title, subtitle, rows, empty }: { title: string; subtitle: string; rows?: Array<{ name: string; value: number }>; empty: string }) {
  const max = Math.max(1, ...(rows ?? []).map(row => row.value));
  return <section className="lc-card p-5"><h2 className="text-sm font-semibold">{title}</h2><p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{subtitle}</p><div className="mt-4 space-y-3">{(rows ?? []).length ? rows!.map(row => <div key={row.name}><div className="flex items-center justify-between gap-3 text-xs"><span className="truncate">{label(row.name)}</span><strong>{row.value}</strong></div><div className="mt-1 h-1.5 rounded-full" style={{ background: "var(--border)" }}><div className="h-1.5 rounded-full bg-emerald-400" style={{ width: `${Math.round(row.value / max * 100)}%` }} /></div></div>) : <p className="py-6 text-center text-xs" style={{ color: "var(--muted-foreground)" }}>{empty}</p>}</div></section>;
}

function duration(seconds: number) { return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}min ${seconds % 60}s`; }
function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <div className="lc-card p-4"><div className="flex items-start justify-between"><div><p className="text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>{label}</p><strong className="mt-2 block text-2xl" style={{ color: "var(--text-title)" }}>{value}</strong><span className="mt-1 block text-[10px]" style={{ color: "var(--muted-foreground)" }}>{detail}</span></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">{icon}</span></div></div>;
}

export function SiteAnalyticsDashboard() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Overview | null>(null);
  const [config, setConfig] = useState<SettingsPayload | null>(null);
  const [pipelineId, setPipelineId] = useState("");
  const [stageId, setStageId] = useState("");
  const [dealValue, setDealValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const stages = useMemo(() => config?.pipelines.find(p => p.id === pipelineId)?.crm_stages.filter(s => s.is_active).sort((a,b) => a.order_index-b.order_index) ?? [], [config, pipelineId]);

  async function load() {
    setLoading(true);
    const [overviewRes, settingsRes] = await Promise.all([fetch(`/api/site-analytics/overview?days=${days}`), fetch("/api/site-analytics/settings")]);
    const overview = await overviewRes.json(); const settings = await settingsRes.json();
    if (!overviewRes.ok || !settingsRes.ok) toast.error(overview.error ?? settings.error ?? "Não foi possível carregar os dados");
    else { setData(overview); setConfig(settings); setPipelineId(settings.settings?.crm_pipeline_id ?? ""); setStageId(settings.settings?.crm_stage_id ?? ""); setDealValue(String(Number(settings.settings?.deal_value ?? 0) || "")); }
    setLoading(false);
  }
  useEffect(() => { void load(); }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveSettings() {
    setSaving(true);
    const response = await fetch("/api/site-analytics/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pipeline_id: pipelineId || null, stage_id: stageId || null, deal_value: dealValue || 0 }) });
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

  if (loading && !data) return <div className="lc-card h-80 animate-pulse" />;
  if (!data) return null;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs" style={{ color: "var(--muted-foreground)" }}>genesycompany.com</p>{data.summary.sessions ? <p className="mt-1 text-sm font-semibold text-emerald-400">Conectado e recebendo dados</p> : <p className="mt-1 text-sm font-semibold text-amber-400">Aguardando os primeiros acessos do site</p>}</div><select value={days} onChange={e => setDays(Number(e.target.value))} className="lc-form-control w-40"><option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option><option value={90}>Últimos 90 dias</option></select></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <Metric icon={<Users size={17}/>} label="Acessos" value={String(data.summary.sessions)} detail={`${data.summary.visitors} visitantes`} />
      <Metric icon={<Eye size={17}/>} label="Visualizações" value={String(data.summary.views)} detail="páginas visualizadas" />
      <Metric icon={<Clock3 size={17}/>} label="Tempo médio" value={duration(data.summary.avg_seconds)} detail="tempo ativo por acesso" />
      <Metric icon={<UserRound size={17}/>} label="Leads" value={String(data.summary.leads)} detail="capturados no site" />
      <Metric icon={<TrendingUp size={17}/>} label="Conversão" value={`${data.summary.conversion_rate}%`} detail="acessos que viraram lead" />
      <Metric icon={<RefreshCw size={17}/>} label="No CRM" value={String(data.leads.filter(l => l.sync_status === "synced").length)} detail="leads sincronizados" />
    </div>
    <div className="grid gap-4 xl:grid-cols-[1.45fr_.55fr]">
      <section className="lc-card p-5"><div className="mb-4"><h2 className="text-sm font-semibold">Evolução dos acessos</h2><p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>Sessões, visualizações e leads ao longo do período</p></div><div className="h-64"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.timeline}><defs><linearGradient id="siteArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={.36}/><stop offset="100%" stopColor="#34d399" stopOpacity={0}/></linearGradient></defs><XAxis dataKey="date" tickFormatter={v => v.slice(5).split("-").reverse().join("/")} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}/><Tooltip contentStyle={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 11 }}/><Area type="monotone" dataKey="sessions" name="Acessos" stroke="#34d399" fill="url(#siteArea)" strokeWidth={2}/><Area type="monotone" dataKey="leads" name="Leads" stroke="#60a5fa" fill="transparent" strokeWidth={2}/></AreaChart></ResponsiveContainer></div></section>
      <section className="lc-card p-5"><h2 className="flex items-center gap-2 text-sm font-semibold"><Settings2 size={15}/> Pipeline do CRM</h2><p className="mt-1 text-[11px]" style={{ color: "var(--muted-foreground)" }}>Novos leads entram automaticamente na etapa escolhida, com o valor do negócio definido abaixo.</p><div className="mt-5 space-y-3"><select value={pipelineId} onChange={e => { setPipelineId(e.target.value); setStageId(""); }} disabled={!config?.canManage} className="lc-form-control w-full"><option value="">Não sincronizar</option>{config?.pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><select value={stageId} onChange={e => setStageId(e.target.value)} disabled={!pipelineId || !config?.canManage} className="lc-form-control w-full"><option value="">Selecionar etapa</option>{stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><label className="block text-[11px]" style={{ color: "var(--muted-foreground)" }}>Valor do negócio (R$)<input type="number" min={0} step="0.01" inputMode="decimal" value={dealValue} onChange={e => setDealValue(e.target.value)} disabled={!config?.canManage} placeholder="0,00" className="lc-form-control mt-1 w-full" /></label>{config?.canManage && <button onClick={() => void saveSettings()} disabled={saving || (!!pipelineId && !stageId)} className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-xs font-bold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-50">{saving ? "Salvando…" : "Salvar integração"}</button>}</div></section>
    </div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Ranking title="Funil do site" subtitle="Do acesso até virar lead" rows={data.funnel} empty="Sem acessos no período." />
      <Ranking title="De onde vêm os acessos" subtitle="Origem (UTM ou site de referência)" rows={data.sources} empty="Sem acessos no período." />
      <Ranking title="Campanhas" subtitle="Acessos por utm_campaign" rows={data.campaigns} empty="Nenhum acesso com campanha (UTM)." />
      <Ranking title="Dispositivos" subtitle="Celular, computador ou tablet" rows={data.devices} empty="Sem acessos no período." />
      <Ranking title="Seções mais vistas" subtitle="Quantas visitas chegaram a cada parte do site" rows={data.sections} empty="Sem dados de seções." />
      <Ranking title={`Cliques${data.whatsapp_clicks ? ` · ${data.whatsapp_clicks} no WhatsApp` : ""}`} subtitle="Botões e links mais clicados" rows={data.clicks} empty="Nenhum clique registrado." />
    </div>
    <section className="lc-card overflow-hidden"><div className="border-b p-5" style={{ borderColor: "var(--border)" }}><h2 className="text-sm font-semibold">Leads do site</h2><p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>Contato, qualificação e situação no CRM</p></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}><th className="px-5 py-3">Lead</th><th className="px-4 py-3">Perfil</th><th className="px-4 py-3">VGV mensal</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">CRM</th></tr></thead><tbody>{data.leads.map(lead => <tr key={lead.id} className="border-t" style={{ borderColor: "var(--border)" }}><td className="px-5 py-3"><p className="text-xs font-semibold">{lead.name}</p><p className="mt-1 text-[10px]" style={{ color: "var(--muted-foreground)" }}>{lead.phone}</p></td><td className="px-4 py-3 text-xs">{lead.profile ?? "—"}</td><td className="px-4 py-3 text-xs">{lead.monthly_vgv ?? "—"}</td><td className="px-4 py-3 text-[11px]">{new Date(lead.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td><td className="px-4 py-3">{lead.sync_status === "synced" ? <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-400">Sincronizado</span> : <button onClick={() => void retry(lead.id)} className="rounded-lg bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-400">{lead.sync_status === "disabled" ? "Configurar e enviar" : "Tentar novamente"}</button>}</td></tr>)}</tbody></table>{!data.leads.length && <p className="p-8 text-center text-xs" style={{ color: "var(--muted-foreground)" }}>Os novos leads do site aparecerão aqui.</p>}</div></section>
  </div>;
}

