"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useUsers } from "@/hooks/useUsers";
import { RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { CrmPipelineWithStages } from "@/types/crm";

type Page = { page_id: string; page_name: string; is_active: boolean; capture_unconfigured_forms?: boolean };
type Form = { id: string; name: string; status: string; is_subscribed: boolean; leads_count: number; last_lead_at: string | null; crm_pipeline_id: string | null; crm_stage_id: string | null; assigned_to: string | null };
type Log = { id: string; received_at: string; form_id: string | null; status: string; error_message: string | null };
const inputClass = "mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2.5 text-sm text-[var(--text-title)]";
async function api(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Não foi possível concluir a operação.");
  return body;
}

export function MetaLeadForms() {
  const { profiles } = useUsers();
  const activeProfiles = profiles.filter((profile) => profile.is_active && profile.auth_user_id);
  const [pages, setPages] = useState<Page[]>([]);
  const [pageId, setPageId] = useState("");
  const [forms, setForms] = useState<Form[]>([]);
  const [pipelines, setPipelines] = useState<CrmPipelineWithStages[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState("");
  const [formsLoading, setFormsLoading] = useState(false);
  const load = useCallback(async () => {
    try {
      const [pageData, crmData, logData] = await Promise.all([api("/api/meta/pages"), api("/api/crm/pipelines"), api("/api/meta/webhook/logs")]);
      setPages(pageData.pages); setPipelines(crmData.pipelines); setLogs(logData.logs);
      setPageId((current) => pageData.pages.some((page: Page) => page.page_id === current) ? current : pageData.pages[0]?.page_id || "");
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao carregar integrações."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!pageId) { setForms([]); return; }
    let live = true; setFormsLoading(true); setForms([]); setError("");
    api(`/api/meta/forms?pageId=${encodeURIComponent(pageId)}`).then((data) => { if (live) setForms(data.forms); })
      .catch((e) => { if (live) setError(e.message); }).finally(() => { if (live) setFormsLoading(false); });
    return () => { live = false; };
  }, [pageId]);
  async function sync() {
    setSyncing(true); setError("");
    try {
      const result = await api("/api/meta/pages/sync", { method: "POST" });
      await load();
      if (pageId) setForms((await api(`/api/meta/forms?pageId=${encodeURIComponent(pageId)}`)).forms);
      if (result.subscribed < result.synced) toast.warning("Algumas páginas não autorizaram a captura. Confira as permissões da Meta.");
      else toast.success("Páginas sincronizadas.");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha na sincronização."); }
    finally { setSyncing(false); }
  }
  function change(id: string, patch: Partial<Form>) { setForms((current) => current.map((form) => form.id === id ? { ...form, ...patch } : form)); }
  async function save(form: Form) {
    setSaving(form.id); setError("");
    try {
      await api("/api/meta/forms/toggle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        pageId, formId: form.id, active: form.is_subscribed, pipelineId: form.crm_pipeline_id, stageId: form.crm_stage_id, assignedTo: form.assigned_to,
      }) });
      toast.success(form.is_subscribed ? "Captura ativada no destino escolhido." : "Captura pausada.");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao salvar."); }
    finally { setSaving(""); }
  }
  async function retry(id: string) {
    setSaving(id);
    try {
      const result = await api("/api/meta/webhook/retry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      toast.success(result.status === "processed" ? "Lead salvo no CRM." : result.status === "duplicate" ? "O lead já está no CRM." : "Formulário pausado ou não configurado.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao reprocessar."); }
    finally { setSaving(""); }
  }
  return <div className="space-y-6 p-4 sm:p-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-semibold text-[var(--text-title)]">Formulários Meta</h1><p className="mt-2 max-w-2xl text-sm text-[var(--muted-foreground)]">Receba os leads dos formulários instantâneos do Facebook e Instagram no CRM escolhido, com seus dados e todas as respostas.</p></div>
      <div className="flex flex-wrap gap-2"><Link href="/marketing/trafego?tab=integracoes" className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm">Conexão Meta</Link><Button variant="outline" icon={<RefreshCw />} loading={syncing} onClick={() => void sync()}>Sincronizar páginas</Button></div>
    </header>
    <div className="lc-card-base rounded-2xl p-4 text-sm text-[var(--muted-foreground)]">Escolha a página, configure o CRM e a etapa para cada formulário e salve. A configuração vale para novos cadastros. Ao configurar uma página, somente os formulários ativados serão capturados. As respostas aparecem nos detalhes do lead, em dados da integração.</div>
    {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">{error}</p>}
    {loading ? <p>Carregando integração…</p> : !pages.length ? <div className="lc-card-base rounded-2xl p-6"><p>Nenhuma página disponível. Conecte sua conta Meta em Tráfego Pago e sincronize as páginas.</p></div> : <>
      <label className="block max-w-lg text-sm">Página do Facebook<select className={inputClass} value={pageId} disabled={Boolean(saving) || syncing} onChange={(e) => setPageId(e.target.value)}>{pages.map((page) => <option key={page.page_id} value={page.page_id}>{page.page_name}</option>)}</select></label>
      {pages.find((page) => page.page_id === pageId)?.capture_unconfigured_forms && <p className="text-sm text-amber-500">Esta página possui captura antiga de todos os formulários. Ao salvar uma configuração, somente os formulários ativados serão capturados.</p>}
      {formsLoading ? <p>Carregando formulários…</p> : !forms.length ? <p>Nenhum formulário disponível nesta página.</p> : <div className="grid gap-4 xl:grid-cols-2">{forms.map((form) => {
        const stages = pipelines.find((pipeline) => pipeline.id === form.crm_pipeline_id)?.crm_stages.filter((stage) => stage.is_active) ?? [];
        return <section key={form.id} className="lc-card-base space-y-4 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold text-[var(--text-title)]">{form.name}</h2><p className="mt-1 text-xs text-[var(--muted-foreground)]">{form.leads_count} leads capturados{form.last_lead_at ? ` · Último: ${new Date(form.last_lead_at).toLocaleString("pt-BR")}` : ""}</p></div><div className="flex shrink-0 items-center gap-2 text-sm"><span>Capturar</span><button type="button" role="switch" aria-label={`Capturar ${form.name}`} aria-checked={form.is_subscribed} disabled={Boolean(saving)} onClick={() => change(form.id, { is_subscribed: !form.is_subscribed })} className="relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50" style={{ background: form.is_subscribed ? "var(--primary)" : "var(--border-card-hover)" }}><span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform" style={{ transform: form.is_subscribed ? "translateX(16px)" : "translateX(0)" }} /></button></div></div>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">CRM de destino<select aria-label={`CRM de ${form.name}`} className={inputClass} disabled={Boolean(saving)} value={form.crm_pipeline_id ?? ""} onChange={(e) => change(form.id, { crm_pipeline_id: e.target.value || null, crm_stage_id: null })}><option value="">Selecione o CRM</option>{pipelines.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}</select></label>
          <label className="text-sm">Etapa de entrada<select aria-label={`Etapa de ${form.name}`} className={inputClass} disabled={!form.crm_pipeline_id || Boolean(saving)} value={form.crm_stage_id ?? ""} onChange={(e) => change(form.id, { crm_stage_id: e.target.value || null })}><option value="">Selecione a etapa</option>{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</select></label></div>
          <label className="block text-sm">Responsável pelos novos leads<select aria-label={`Responsável de ${form.name}`} className={inputClass} disabled={Boolean(saving)} value={form.assigned_to ?? ""} onChange={(e) => change(form.id, { assigned_to: e.target.value || null })}><option value="">Sem responsável</option>{activeProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}</select></label>
          <Button icon={<Save />} loading={saving === form.id} disabled={Boolean(saving) || (form.is_subscribed && !form.crm_stage_id)} onClick={() => void save(form)}>Salvar configuração</Button>
        </section>;
      })}</div>}
    </>}
    <section className="lc-card-base rounded-2xl p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Últimas capturas</h2><Button variant="ghost" onClick={() => void load()} icon={<RefreshCw />}>Atualizar</Button></div>
      {!logs.length ? <p className="mt-3 text-sm text-[var(--muted-foreground)]">Os novos cadastros aparecerão aqui após o envio pela Meta.</p> : <ul className="mt-3 divide-y divide-[var(--border)]">{logs.map((log) => <li key={log.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><p>{new Date(log.received_at).toLocaleString("pt-BR")} · {{ processed: "Salvo no CRM", duplicate: "Já capturado", error: "Falha", received: "Recebido", skipped: "Não capturado" }[log.status] || log.status}</p><p className="text-xs text-[var(--muted-foreground)]">{forms.find((form) => form.id === log.form_id)?.name || `Formulário ${log.form_id || "—"}`}</p>{log.error_message && <p className="mt-1 text-red-500">{log.error_message}</p>}</div>{["error", "received"].includes(log.status) && <Button variant="outline" loading={saving === log.id} disabled={Boolean(saving)} onClick={() => void retry(log.id)}>Reprocessar</Button>}</li>)}</ul>}
    </section>
  </div>;
}
