"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, CheckCircle2, MessageCircle, Pencil, Plus, Trash2, Webhook, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";

type Step = { type: "message"; text: string; delayMinutes: number };
type Automation = {
  id: string; connection_id: string; name: string; status: "draft" | "active" | "paused";
  trigger_type: "comment" | "message" | "story_reply" | "postback";
  match_type: "contains" | "exact" | "starts_with" | "any"; keywords: string[];
  public_reply_text: string | null; steps: Step[]; crm_enabled: boolean;
  crm_pipeline_id: string | null; crm_stage_id: string | null;
  metrics: { triggers: number; completed: number; failed: number; messagesSent: number };
};
type Connection = { id: string; username: string; status: string; webhook_subscribed: boolean; webhook_error: string | null; requested_scopes: string[] };
type Pipeline = { id: string; name: string; crm_stages: Array<{ id: string; name: string; is_active: boolean; order_index: number }> };

type FormState = {
  name: string; connectionId: string; status: "draft" | "active" | "paused";
  triggerType: "comment" | "message" | "story_reply" | "postback";
  matchType: "contains" | "exact" | "starts_with" | "any"; keywords: string; publicReplyText: string;
  steps: Step[]; crmEnabled: boolean; crmPipelineId: string; crmStageId: string;
};

const EMPTY: FormState = {
  name: "", connectionId: "", status: "draft", triggerType: "comment",
  matchType: "contains", keywords: "", publicReplyText: "Te mandei no direct!",
  steps: [{ type: "message", text: "", delayMinutes: 0 }], crmEnabled: false,
  crmPipelineId: "", crmStageId: "",
};

const inputClass = "min-h-10 w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--primary)]";

export default function InstagramAutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/marketing/instagram/automations", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) toast.error(data.error ?? "Não foi possível carregar as automações");
    else {
      setAutomations(data.automations ?? []); setConnections(data.connections ?? []);
      setPipelines(data.pipelines ?? []); setIsAdmin(Boolean(data.is_admin));
      setForm(current => current.connectionId || !(data.connections ?? []).length ? current : { ...current, connectionId: data.connections[0].id });
    }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const selectedPipeline = pipelines.find(item => item.id === form.crmPipelineId);
  const stages = useMemo(() => (selectedPipeline?.crm_stages ?? []).filter(stage => stage.is_active).sort((a, b) => a.order_index - b.order_index), [selectedPipeline]);
  const reset = () => {
    setEditingId(null);
    setForm({ ...EMPTY, connectionId: connections[0]?.id ?? "", steps: [{ type: "message", text: "", delayMinutes: 0 }] });
  };
  const edit = (item: Automation) => {
    setEditingId(item.id);
    setForm({
      name: item.name, connectionId: item.connection_id, status: item.status, triggerType: item.trigger_type,
      matchType: item.match_type, keywords: item.keywords.join("\n"), publicReplyText: item.public_reply_text ?? "",
      steps: item.steps?.length ? item.steps : [{ type: "message", text: "", delayMinutes: 0 }],
      crmEnabled: item.crm_enabled, crmPipelineId: item.crm_pipeline_id ?? "", crmStageId: item.crm_stage_id ?? "",
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
    };
    const response = await fetch(editingId ? `/api/marketing/instagram/automations/${editingId}` : "/api/marketing/instagram/automations", {
      method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) toast.error(data.error ?? "Não foi possível salvar");
    else { toast.success(editingId ? "Automação atualizada" : "Automação criada"); reset(); await load(); }
    setSaving(false);
  };
  const remove = async (id: string) => {
    if (!window.confirm("Excluir esta automação e o histórico associado?")) return;
    const response = await fetch(`/api/marketing/instagram/automations/${id}`, { method: "DELETE" });
    if (response.ok) { toast.success("Automação excluída"); await load(); }
    else toast.error("Não foi possível excluir");
  };

  return (
    <div className="pb-10">
      <Header title="Automações do Instagram" subtitle="Transforme comentários e directs em conversas e oportunidades no CRM" />
      <div className="grid gap-5 px-4 sm:px-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,.95fr)]">
        <section className="rounded-2xl border p-4 sm:p-5" style={{ background: "var(--glass-bg-soft)" }}>
          <div className="mb-5 flex items-center justify-between gap-3">
            <div><h2 className="font-semibold">{editingId ? "Editar automação" : "Nova automação"}</h2><p className="text-xs text-[var(--muted-foreground)]">Defina o gatilho, a resposta e o destino no CRM.</p></div>
            {editingId && <button onClick={reset} className="text-xs text-[var(--primary)]">Cancelar edição</button>}
          </div>
          {!isAdmin && !loading ? <Notice tone="warning">Somente administradores podem configurar automações.</Notice> : connections.length === 0 && !loading ? <Notice tone="warning">Conecte primeiro uma conta profissional na aba Instagram.</Notice> : (
            <div className="space-y-4">
              <Field label="Nome"><input className={inputClass} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Enviar material do lançamento" /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Conta profissional"><select className={inputClass} value={form.connectionId} onChange={event => setForm({ ...form, connectionId: event.target.value })}>{connections.map(item => <option key={item.id} value={item.id}>@{item.username}</option>)}</select></Field>
                <Field label="Status"><select className={inputClass} value={form.status} onChange={event => setForm({ ...form, status: event.target.value as typeof form.status })}><option value="draft">Rascunho</option><option value="active">Ativa</option><option value="paused">Pausada</option></select></Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Quando alguém"><select className={inputClass} value={form.triggerType} onChange={event => {
                  const triggerType = event.target.value as typeof form.triggerType;
                  setForm({ ...form, triggerType, steps: triggerType === "comment" ? form.steps.slice(0, 1) : form.steps });
                }}><option value="comment">Comentar em uma publicação</option><option value="message">Enviar uma mensagem</option><option value="story_reply">Responder a um story</option><option value="postback">Tocar em um botão</option></select></Field>
                <Field label="Correspondência"><select className={inputClass} value={form.matchType} onChange={event => setForm({ ...form, matchType: event.target.value as typeof form.matchType })}><option value="contains">Contém a palavra/frase</option><option value="exact">É exatamente igual</option><option value="starts_with">Começa com</option><option value="any">Qualquer texto</option></select></Field>
              </div>
              {form.matchType !== "any" && <Field label="Palavras ou frases (uma por linha)"><textarea className={`${inputClass} min-h-24`} value={form.keywords} onChange={event => setForm({ ...form, keywords: event.target.value })} placeholder={'quero saber mais\nme manda\nlançamento'} /></Field>}
              {form.triggerType === "comment" && <Field label="Resposta pública automática"><input className={inputClass} value={form.publicReplyText} onChange={event => setForm({ ...form, publicReplyText: event.target.value })} placeholder="Te mandei no direct!" /></Field>}
              <div>
                <div className="mb-2 flex items-center justify-between"><label className="text-sm font-medium">Sequência no Direct</label>{form.triggerType !== "comment" && form.steps.length < 10 && <button onClick={() => setForm({ ...form, steps: [...form.steps, { type: "message", text: "", delayMinutes: 0 }] })} className="flex items-center gap-1 text-xs text-[var(--primary)]"><Plus size={13} /> Adicionar mensagem</button>}</div>
                <div className="space-y-3">{form.steps.map((step, index) => <div key={index} className="rounded-xl border p-3"><div className="mb-2 flex items-center justify-between text-xs text-[var(--muted-foreground)]"><span>Mensagem {index + 1}{form.triggerType === "comment" ? " · resposta privada" : ""}</span>{form.steps.length > 1 && <button onClick={() => setForm({ ...form, steps: form.steps.filter((_, position) => position !== index) })}><Trash2 size={14} /></button>}</div><textarea className={`${inputClass} min-h-20`} value={step.text} onChange={event => setForm({ ...form, steps: form.steps.map((item, position) => position === index ? { ...item, text: event.target.value } : item) })} placeholder="Olá! Aqui está o material que você pediu..." />{form.triggerType !== "comment" && <label className="mt-2 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">Esperar <input type="number" min={0} max={1380} className="w-24 rounded-lg border bg-transparent px-2 py-1" value={step.delayMinutes} onChange={event => setForm({ ...form, steps: form.steps.map((item, position) => position === index ? { ...item, delayMinutes: Number(event.target.value) } : item) })} /> minutos</label>}</div>)}</div>
              </div>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border p-3"><input type="checkbox" checked={form.crmEnabled} onChange={event => setForm({ ...form, crmEnabled: event.target.checked })} /><span><strong className="block text-sm">Criar oportunidade no CRM</strong><span className="text-xs text-[var(--muted-foreground)]">Um mesmo contato não será criado duas vezes.</span></span></label>
              {form.crmEnabled && <div className="grid gap-3 sm:grid-cols-2"><Field label="Pipeline"><select className={inputClass} value={form.crmPipelineId} onChange={event => setForm({ ...form, crmPipelineId: event.target.value, crmStageId: "" })}><option value="">Selecione</option>{pipelines.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Etapa inicial"><select className={inputClass} value={form.crmStageId} onChange={event => setForm({ ...form, crmStageId: event.target.value })}><option value="">Selecione</option>{stages.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field></div>}
              <button disabled={saving || !isAdmin || !connections.length} onClick={save} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"><Bot size={16} />{saving ? "Salvando..." : editingId ? "Salvar alterações" : "Criar automação"}</button>
            </div>
          )}
        </section>

        <div className="space-y-4">
          {connections.map(connection => <section key={connection.id} className="rounded-2xl border p-4" style={{ background: "var(--glass-bg-soft)" }}><div className="flex items-start gap-3">{connection.webhook_subscribed ? <CheckCircle2 className="mt-0.5 text-emerald-500" size={19} /> : <XCircle className="mt-0.5 text-amber-500" size={19} />}<div><h3 className="text-sm font-semibold">@{connection.username}</h3><p className="text-xs text-[var(--muted-foreground)]">{connection.webhook_subscribed ? "Webhooks de comentários e mensagens assinados" : "Reconecte a conta após liberar as permissões na Meta"}</p>{connection.webhook_error && <p className="mt-1 text-xs text-amber-500">{connection.webhook_error}</p>}</div></div></section>)}
          <div className="flex items-center gap-2"><Webhook size={17} /><h2 className="font-semibold">Automações configuradas</h2></div>
          {loading ? <p className="text-sm text-[var(--muted-foreground)]">Carregando...</p> : automations.length === 0 ? <Notice tone="neutral">Nenhuma automação criada ainda.</Notice> : automations.map(item => <section key={item.id} className="rounded-2xl border p-4" style={{ background: "var(--glass-bg-soft)" }}><div className="flex items-start justify-between gap-3"><div><div className="mb-1 flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${item.status === "active" ? "bg-emerald-500" : item.status === "paused" ? "bg-amber-500" : "bg-slate-400"}`} /><h3 className="text-sm font-semibold">{item.name}</h3></div><p className="text-xs text-[var(--muted-foreground)]">{item.trigger_type === "comment" ? "Comentário" : item.trigger_type === "message" ? "Mensagem" : item.trigger_type === "story_reply" ? "Resposta a story" : "Botão"} · {item.match_type === "any" ? "qualquer texto" : item.keywords.join(", ")}</p></div>{isAdmin && <div className="flex gap-1"><button onClick={() => edit(item)} className="rounded-lg p-2 hover:bg-[var(--hover)]" aria-label="Editar"><Pencil size={14} /></button><button onClick={() => remove(item.id)} className="rounded-lg p-2 text-red-400 hover:bg-[var(--hover)]" aria-label="Excluir"><Trash2 size={14} /></button></div>}</div><div className="mt-4 grid grid-cols-4 gap-2 text-center"><Metric value={item.metrics.triggers} label="Gatilhos" /><Metric value={item.metrics.messagesSent} label="Ações" /><Metric value={item.metrics.completed} label="Concluídas" /><Metric value={item.metrics.failed} label="Falhas" /></div><div className="mt-3 flex items-center gap-2 text-xs text-[var(--muted-foreground)]"><MessageCircle size={13} />{item.steps.length} mensagem{item.steps.length === 1 ? "" : "s"}{item.crm_enabled ? " · CRM ativo" : ""}</div></section>)}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-sm font-medium">{label}</span>{children}</label>; }
function Metric({ value, label }: { value: number; label: string }) { return <div className="rounded-lg border px-1 py-2"><strong className="block text-sm">{value}</strong><span className="text-[10px] text-[var(--muted-foreground)]">{label}</span></div>; }
function Notice({ children, tone }: { children: React.ReactNode; tone: "warning" | "neutral" }) { return <div className={`rounded-xl border p-4 text-sm ${tone === "warning" ? "border-amber-500/30 text-amber-500" : "text-[var(--muted-foreground)]"}`}>{children}</div>; }
