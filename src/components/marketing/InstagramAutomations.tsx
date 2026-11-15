"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, CheckCircle2, MessageCircle, Pencil, Plus, Trash2, Webhook, XCircle } from "lucide-react";
import { toast } from "sonner";
import { LeadOriginSelector } from "@/components/crm/LeadOriginSelector";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type Step = { type: "message"; text: string; delayMinutes: number; button?: { label: string; url: string } | null };
type Automation = {
  id: string; connection_id: string; name: string; status: "draft" | "active" | "paused";
  trigger_type: "comment" | "message" | "story_reply" | "postback";
  match_type: "contains" | "exact" | "starts_with" | "any"; keywords: string[];
  public_reply_text: string | null; steps: Step[]; crm_enabled: boolean;
  crm_pipeline_id: string | null; crm_stage_id: string | null;
  crm_origin_id: string | null; crm_assigned_to: string | null; crm_deal_value: number;
  metrics: { triggers: number; completed: number; failed: number; messagesSent: number };
};
type Connection = { id: string; username: string; status: string; webhook_subscribed: boolean; webhook_error: string | null; requested_scopes: string[] };
type Pipeline = { id: string; name: string; crm_stages: Array<{ id: string; name: string; is_active: boolean; order_index: number }> };
type Profile = { id: string; full_name: string; job_title: string | null; is_active: boolean };

type FormState = {
  name: string; connectionId: string; status: "draft" | "active" | "paused";
  triggerType: "comment" | "message" | "story_reply" | "postback";
  matchType: "contains" | "exact" | "starts_with" | "any"; keywords: string; publicReplyText: string;
  steps: Step[]; crmEnabled: boolean; crmPipelineId: string; crmStageId: string;
  crmOriginId: string; crmAssignedTo: string; crmDealValue: number;
};

const EMPTY: FormState = {
  name: "", connectionId: "", status: "draft", triggerType: "comment",
  matchType: "contains", keywords: "", publicReplyText: "Te mandei no direct!",
  steps: [{ type: "message", text: "", delayMinutes: 0 }], crmEnabled: false,
  crmPipelineId: "", crmStageId: "", crmOriginId: "", crmAssignedTo: "", crmDealValue: 0,
};

const inputClass = "min-h-10 w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--primary)]";

export function InstagramAutomations({ accountId, createSignal = 0 }: { accountId?: string; createSignal?: number }) {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const openedSignal = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
    const response = await fetch("/api/marketing/instagram/automations", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) toast.error(data.error ?? "Não foi possível carregar as automações");
    else {
      setAutomations(data.automations ?? []); setConnections(data.connections ?? []);
      setPipelines(data.pipelines ?? []); setIsAdmin(Boolean(data.is_admin));
      setProfiles(data.profiles ?? []);
      setForm(current => current.connectionId || !(data.connections ?? []).length ? current : { ...current, connectionId: data.connections[0].id });
    }
    } catch { toast.error("Não foi possível carregar as automações. Tente atualizar."); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (accountId && !editingId) setForm(current => ({ ...current, connectionId: accountId })); }, [accountId, editingId]);
  const visibleAutomations = accountId ? automations.filter(item => item.connection_id === accountId) : automations;
  const visibleConnections = accountId ? connections.filter(item => item.id === accountId) : connections;

  const selectedPipeline = pipelines.find(item => item.id === form.crmPipelineId);
  const stages = useMemo(() => (selectedPipeline?.crm_stages ?? []).filter(stage => stage.is_active).sort((a, b) => a.order_index - b.order_index), [selectedPipeline]);
  const reset = () => {
    setEditingId(null);
    setForm({ ...EMPTY, connectionId: accountId || connections[0]?.id || "", steps: [{ type: "message", text: "", delayMinutes: 0 }] });
    setEditorOpen(false);
  };
  useEffect(() => {
    if (!createSignal || createSignal === openedSignal.current || loading || !isAdmin || !connections.length) return;
    openedSignal.current = createSignal;
    setEditingId(null);
    setForm({ ...EMPTY, connectionId: accountId || connections[0]?.id || "", steps: [{ type: "message", text: "", delayMinutes: 0 }] });
    setEditorOpen(true);
  }, [accountId, connections, createSignal, isAdmin, loading]);
  const edit = (item: Automation) => {
    setEditingId(item.id);
    setEditorOpen(true);
    setForm({
      name: item.name, connectionId: item.connection_id, status: item.status, triggerType: item.trigger_type,
      matchType: item.match_type, keywords: item.keywords.join("\n"), publicReplyText: item.public_reply_text ?? "",
      steps: item.steps?.length ? item.steps : [{ type: "message", text: "", delayMinutes: 0 }],
      crmEnabled: item.crm_enabled, crmPipelineId: item.crm_pipeline_id ?? "", crmStageId: item.crm_stage_id ?? "",
      crmOriginId: item.crm_origin_id ?? "", crmAssignedTo: item.crm_assigned_to ?? "", crmDealValue: Number(item.crm_deal_value ?? 0),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const save = async () => {
    setSaving(true);
    const payload = {
      ...form,
      keywords: form.keywords.split(/[\n,]/).map(value => value.trim()).filter(Boolean),
      publicReplyText: form.triggerType === "comment" ? form.publicReplyText : null,
      crmPipelineId: form.crmEnabled ? form.crmPipelineId : null,
      crmStageId: form.crmEnabled ? form.crmStageId : null,
      crmOriginId: form.crmEnabled ? form.crmOriginId || null : null,
      crmAssignedTo: form.crmEnabled ? form.crmAssignedTo || null : null,
      crmDealValue: form.crmEnabled ? form.crmDealValue : 0,
    };
    try {
    const response = await fetch(editingId ? `/api/marketing/instagram/automations/${editingId}` : "/api/marketing/instagram/automations", {
      method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) toast.error(data.error ?? "Não foi possível salvar");
    else { toast.success(editingId ? "Automação atualizada" : "Automação criada"); reset(); await load(); window.dispatchEvent(new Event("instagram-publication-updated")); }
    } catch { toast.error("Falha ao salvar a automação. Confira a lista antes de tentar novamente."); } finally { setSaving(false); }
  };
  const remove = async (id: string) => {
    if (!window.confirm("Excluir esta automação e o histórico associado?")) return;
    try {
    const response = await fetch(`/api/marketing/instagram/automations/${id}`, { method: "DELETE" });
    if (response.ok) { toast.success("Automação excluída"); await load(); window.dispatchEvent(new Event("instagram-publication-updated")); }
    else toast.error("Não foi possível excluir");
    } catch { toast.error("Não foi possível excluir. Atualize a lista antes de tentar novamente."); }
  };

  const toggle = async (item: Automation) => {
    setTogglingId(item.id);
    try {
      const response = await fetch(`/api/marketing/instagram/automations/${item.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: item.status === "active" ? "paused" : "active" }),
      });
      const data = await response.json();
      if (!response.ok) toast.error(data.error ?? "Não foi possível atualizar a automação");
      else { toast.success(data.automation.status === "active" ? "Automação ativada" : "Automação pausada"); await load(); window.dispatchEvent(new Event("instagram-publication-updated")); }
    } catch { toast.error("Falha ao atualizar. Confira o status antes de tentar novamente."); }
    finally { setTogglingId(null); }
  };

  return (
    <div className="pb-10">
      <div className="ig-auto-heading"><h2>Comentários e Direct</h2><p>Automações ativas, métricas e respostas da sua audiência.</p></div>
      {visibleConnections.map(connection => <section key={connection.id} className="mb-5 flex items-start gap-3 rounded-2xl border p-4" style={{ background: "var(--glass-bg-soft)" }}>{connection.webhook_subscribed ? <CheckCircle2 className="mt-0.5 text-emerald-500" size={19} /> : <XCircle className="mt-0.5 text-amber-500" size={19} />}<div><h3 className="text-sm font-semibold">@{connection.username}</h3><p className="text-xs text-[var(--muted-foreground)]">{connection.webhook_subscribed ? "Webhooks de comentários e mensagens assinados" : "Reconecte a conta após liberar as permissões na Meta"}</p>{connection.webhook_error && <p className="mt-1 text-xs text-amber-500">{connection.webhook_error}</p>}</div></section>)}
      <section className="ig-glass p-4 sm:p-5"><div className="mb-4 flex items-center justify-between"><div><span className="ig-eyebrow">SUAS REGRAS</span><h3 className="mt-1 font-semibold">Automações configuradas</h3></div><Webhook size={18} /></div>{loading ? <p className="text-sm text-[var(--muted-foreground)]">Carregando automações…</p> : visibleAutomations.length === 0 ? <Notice tone="neutral">Nenhuma automação criada ainda. Crie uma para começar a responder às interações.</Notice> : <div className="grid gap-3 md:grid-cols-2">{visibleAutomations.map(item => <article key={item.id} className="rounded-2xl border p-4" style={{ background: "var(--glass-bg-soft)" }}><div className="flex items-start justify-between gap-3"><div><div className="mb-1 flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${item.status === "active" ? "bg-emerald-500" : item.status === "paused" ? "bg-amber-500" : "bg-slate-400"}`} /><h4 className="text-sm font-semibold">{item.name}</h4></div><p className="text-xs text-[var(--muted-foreground)]">{item.trigger_type === "comment" ? "Comentário" : item.trigger_type === "message" ? "Mensagem" : item.trigger_type === "story_reply" ? "Resposta a story" : "Botão"} · {item.match_type === "any" ? "qualquer texto" : item.keywords.join(", ")}</p></div>{isAdmin && <div className="flex items-center gap-2"><button type="button" role="switch" aria-checked={item.status === "active"} aria-label={`${item.status === "active" ? "Pausar" : "Ativar"} ${item.name}`} disabled={togglingId === item.id} onClick={() => void toggle(item)} className="relative h-[22px] w-10 shrink-0 rounded-full transition-colors disabled:opacity-50" style={{ background: item.status === "active" ? "var(--primary)" : "var(--border)" }}><span className="absolute left-0.5 top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-transform" style={{ transform: item.status === "active" ? "translateX(18px)" : "translateX(0)" }} /></button><button onClick={() => edit(item)} className="rounded-lg p-2 hover:bg-[var(--hover)]" aria-label={`Editar ${item.name}`}><Pencil size={14} /></button><button onClick={() => remove(item.id)} className="rounded-lg p-2 text-red-400 hover:bg-[var(--hover)]" aria-label={`Excluir ${item.name}`}><Trash2 size={14} /></button></div>}</div><div className="mt-4 grid grid-cols-4 gap-2 text-center"><Metric value={item.metrics.triggers} label="Gatilhos" /><Metric value={item.metrics.messagesSent} label="Ações" /><Metric value={item.metrics.completed} label="Concluídas" /><Metric value={item.metrics.failed} label="Falhas" /></div><div className="mt-3 flex items-center gap-2 text-xs text-[var(--muted-foreground)]"><MessageCircle size={13} />{item.steps.length} mensagem{item.steps.length === 1 ? "" : "s"}{item.crm_enabled ? " · CRM ativo" : ""}{item.steps.some(step => step.button) ? " · botão com link" : ""}</div></article>)}</div>}</section>
      <Dialog open={editorOpen} onOpenChange={open => { if (!open && !saving) setEditorOpen(false); }}><DialogContent className="ig-studio-composer ig-automation-dialog" overlayClassName="ig-studio-overlay"><div className="ig-dialog-heading"><span className="ig-eyebrow">EDITOR VISUAL</span><DialogTitle>{editingId ? "Editar automação" : "Nova automação"}</DialogTitle><p>Configure o gatilho, as mensagens e confira a prévia ao lado.</p></div><div className="ig-automation-editor-grid">
        <section className="ig-glass p-4 sm:p-5"><div className="space-y-4">{!isAdmin && !loading ? <Notice tone="warning">Somente administradores podem configurar automações.</Notice> : connections.length === 0 && !loading ? <Notice tone="warning">Conecte primeiro uma conta profissional na aba Instagram.</Notice> : <>
          <Field label="Nome da automação"><input className={inputClass} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Enviar material do lançamento" /></Field>
          <Field label="Conta profissional"><select className={inputClass} value={form.connectionId} onChange={event => setForm({ ...form, connectionId: event.target.value })}>{visibleConnections.map(item => <option key={item.id} value={item.id}>@{item.username}</option>)}</select></Field>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Quando alguém"><select className={inputClass} value={form.triggerType} onChange={event => { const triggerType = event.target.value as typeof form.triggerType; setForm({ ...form, triggerType, matchType: triggerType === "comment" && form.matchType === "any" ? "contains" : form.matchType, steps: triggerType === "comment" ? form.steps.slice(0, 1) : form.steps }); }}><option value="comment">Comentar em uma publicação</option><option value="message">Enviar uma mensagem</option><option value="story_reply">Responder a um story</option><option value="postback">Tocar em um botão</option></select></Field><Field label="Correspondência"><select className={inputClass} value={form.matchType} onChange={event => setForm({ ...form, matchType: event.target.value as typeof form.matchType })}><option value="contains">Contém a palavra/frase</option><option value="exact">É exatamente igual</option><option value="starts_with">Começa com</option>{form.triggerType !== "comment" && <option value="any">Qualquer texto</option>}</select></Field></div>
          {form.matchType !== "any" && <Field label="Palavras ou frases (uma por linha)"><textarea className={`${inputClass} min-h-20`} value={form.keywords} onChange={event => setForm({ ...form, keywords: event.target.value })} placeholder={'quero saber mais\nme manda\nlançamento'} /></Field>}{form.triggerType === "comment" && <Field label="Resposta pública automática"><input className={inputClass} value={form.publicReplyText} onChange={event => setForm({ ...form, publicReplyText: event.target.value })} placeholder="Te mandei no direct!" /></Field>}
          <div><div className="mb-2 flex items-center justify-between"><label className="text-sm font-medium">Sequência no Direct</label>{form.triggerType !== "comment" && form.steps.length < 5 && <button onClick={() => setForm({ ...form, steps: [...form.steps, { type: "message", text: "", delayMinutes: 1 }] })} className="flex items-center gap-1 text-xs text-[var(--primary)]"><Plus size={13} />Adicionar mensagem</button>}</div><div className="space-y-3">{form.steps.map((step, index) => <div key={index} className="rounded-xl border p-3"><div className="mb-2 flex items-center justify-between text-xs text-[var(--muted-foreground)]"><span>Mensagem {index + 1}{form.triggerType === "comment" ? " · resposta privada" : ""}</span>{form.steps.length > 1 && <button aria-label="Remover mensagem" onClick={() => setForm({ ...form, steps: form.steps.filter((_, position) => position !== index) })}><Trash2 size={14} /></button>}</div><textarea className={`${inputClass} min-h-20`} value={step.text} onChange={event => setForm({ ...form, steps: form.steps.map((item, position) => position === index ? { ...item, text: event.target.value } : item) })} placeholder="Olá! Aqui está o material que você pediu..." />{form.triggerType !== "comment" && <label className="mt-2 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">Esperar <input type="number" min={0} max={1380} className="w-24 rounded-lg border bg-transparent px-2 py-1" value={step.delayMinutes} onChange={event => setForm({ ...form, steps: form.steps.map((item, position) => position === index ? { ...item, delayMinutes: Number(event.target.value) } : item) })} /> minutos</label>}<div className="mt-3 grid gap-2 sm:grid-cols-2"><Field label="Texto do botão de link"><input className={inputClass} maxLength={20} value={step.button?.label ?? ""} onChange={event => setForm({ ...form, steps: form.steps.map((item, position) => position === index ? { ...item, button: event.target.value ? { label: event.target.value, url: item.button?.url ?? "" } : null } : item) })} placeholder="Acessar material" /></Field><Field label="Link (HTTPS)"><input className={inputClass} type="url" value={step.button?.url ?? ""} onChange={event => setForm({ ...form, steps: form.steps.map((item, position) => position === index ? { ...item, button: { label: item.button?.label ?? "Ver link", url: event.target.value } } : item) })} placeholder="https://seusite.com/material" /></Field></div></div>)}</div></div>
          <div className="ig-crm-toggle"><span><strong>Criar oportunidade no CRM</strong><small>Evita contatos duplicados.</small></span><button type="button" role="switch" aria-checked={form.crmEnabled} aria-label="Criar oportunidade no CRM" onClick={() => setForm({ ...form, crmEnabled: !form.crmEnabled })} className="relative shrink-0 rounded-full transition-colors" style={{ background: form.crmEnabled ? "var(--primary)" : "var(--border)", width: "40px", height: "22px" }}><span className="absolute left-0.5 top-0.5 rounded-full bg-white shadow transition-transform" style={{ width: "18px", height: "18px", transform: form.crmEnabled ? "translateX(18px)" : "translateX(0)" }} /></button></div>
          {form.crmEnabled && <div className="space-y-3 rounded-xl border p-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Pipeline"><select className={inputClass} value={form.crmPipelineId} onChange={event => setForm({ ...form, crmPipelineId: event.target.value, crmStageId: "" })}><option value="">Selecione</option>{pipelines.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Etapa inicial"><select className={inputClass} value={form.crmStageId} onChange={event => setForm({ ...form, crmStageId: event.target.value })}><option value="">Selecione</option>{stages.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Origem"><LeadOriginSelector value={form.crmOriginId || null} onChange={originId => setForm({ ...form, crmOriginId: originId ?? "" })} placeholder="Selecione ou crie" /></Field><Field label="Responsável"><select className={inputClass} value={form.crmAssignedTo} onChange={event => setForm({ ...form, crmAssignedTo: event.target.value })}><option value="">Sem responsável</option>{profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.full_name}{profile.job_title ? ` — ${profile.job_title}` : ""}</option>)}</select></Field></div><Field label="Valor do negócio (R$)"><input type="number" min={0} step="0.01" className={inputClass} value={form.crmDealValue} onChange={event => setForm({ ...form, crmDealValue: Math.max(0, Number(event.target.value) || 0) })} /></Field></div>}
          <div className="flex gap-2"><button className="ig-btn flex-1" onClick={reset}>Cancelar</button><button disabled={saving || !isAdmin || !connections.length} onClick={save} className="ig-btn ig-primary flex-1"><Bot size={16} />{saving ? "Salvando…" : editingId ? "Salvar alterações" : "Criar automação"}</button></div>
        </>}</div></section>
        <section className="ig-auto-preview rounded-2xl border p-5" aria-live="polite"><div className="mb-4 flex items-center justify-between"><div><span className="ig-eyebrow">PRÉVIA EM TEMPO REAL</span><h3 className="mt-1 text-sm font-semibold">Assim funciona para o contato</h3></div><span className={`rounded-full px-2.5 py-1 text-[10px] ${form.status === "active" ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500"}`}>{form.status === "active" ? "Ativa" : form.status === "paused" ? "Pausada" : "Rascunho"}</span></div><div className="ig-auto-preview-step"><small className="text-[10px] text-[var(--muted-foreground)]">GATILHO</small><div className="mt-1 rounded-xl border p-3 text-xs">{form.triggerType === "comment" ? "Comenta na publicação" : form.triggerType === "message" ? "Envia uma mensagem" : form.triggerType === "story_reply" ? "Responde a um story" : "Toca em um botão"}{form.matchType !== "any" && <strong className="mt-1 block">{form.keywords.split(/[\n,]/).map(x => x.trim()).filter(Boolean).join(" · ") || "Suas palavras-chave"}</strong>}</div></div>{form.triggerType === "comment" && <div className="ig-auto-preview-step"><small className="text-[10px] text-[var(--muted-foreground)]">RESPOSTA PÚBLICA</small><div className="mt-1 rounded-xl rounded-tl-sm bg-[var(--hover)] p-3 text-xs">{form.publicReplyText || "Sua resposta pública aparecerá aqui"}</div></div>}{form.steps.map((step, index) => <div className="ig-auto-preview-step" key={index}><small className="text-[10px] text-[var(--muted-foreground)]">DIRECT {index + 1}{step.delayMinutes > 0 ? ` · após ${step.delayMinutes} min` : " · imediato"}</small><div className="mt-1 rounded-xl rounded-tl-sm bg-[color-mix(in_srgb,var(--primary)_16%,var(--glass-bg-soft))] p-3 text-xs">{step.text || "Sua mensagem automática aparecerá aqui"}</div>{step.button?.url && <div className="mt-2 inline-flex rounded-full bg-[var(--primary)] px-3 py-2 text-[10px] font-semibold text-white">{step.button.label || "Abrir link"} ↗</div>}</div>)}{form.crmEnabled && <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 text-xs"><strong className="text-emerald-500">Oportunidade no CRM</strong><p className="mt-1 text-[var(--muted-foreground)]">{selectedPipeline?.name || "Pipeline"} · {stages.find(stage => stage.id === form.crmStageId)?.name || "etapa inicial"}{form.crmDealValue > 0 ? ` · R$ ${form.crmDealValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""}</p></div>}<p className="mt-4 flex items-center gap-2 text-[10px] text-[var(--muted-foreground)]"><MessageCircle size={13} />Prévia ilustrativa da mensagem e do botão.</p></section>
      </div></DialogContent></Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-sm font-medium">{label}</span>{children}</label>; }
function Metric({ value, label }: { value: number; label: string }) { return <div className="rounded-lg border px-1 py-2"><strong className="block text-sm">{value}</strong><span className="text-[10px] text-[var(--muted-foreground)]">{label}</span></div>; }
function Notice({ children, tone }: { children: React.ReactNode; tone: "warning" | "neutral" }) { return <div className={`rounded-xl border p-4 text-sm ${tone === "warning" ? "border-amber-500/30 text-amber-500" : "text-[var(--muted-foreground)]"}`}>{children}</div>; }
