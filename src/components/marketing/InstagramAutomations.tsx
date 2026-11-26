"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, GitBranch, Hourglass, MessageSquareText, Pencil, Tag, Target, Timer, Trash2, Webhook, XCircle, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  AutomationFlowBuilder,
  keywordList,
  starterFlow,
  type BuilderState,
} from "@/components/marketing/instagram/AutomationFlowBuilder";
import { flowStats, legacyStepsToFlow, nextNodeId, type AutomationFlow, type FlowNode } from "@/lib/instagram-automation/flow";

type Step = { type: "message"; text: string; delayMinutes: number; button?: { label: string; url: string } | null };
type Automation = {
  id: string; connection_id: string; name: string; status: "draft" | "active" | "paused";
  trigger_type: "comment" | "message" | "story_reply" | "postback";
  match_type: "contains" | "exact" | "starts_with" | "any"; keywords: string[];
  public_reply_text: string | null; steps: Step[]; flow: AutomationFlow | null; crm_enabled: boolean;
  crm_pipeline_id: string | null; crm_stage_id: string | null;
  crm_origin_id: string | null; crm_assigned_to: string | null; crm_deal_value: number;
  metrics: { triggers: number; completed: number; failed: number; messagesSent: number };
};
type Connection = { id: string; username: string; status: string; webhook_subscribed: boolean; webhook_error: string | null; requested_scopes: string[] };
type Pipeline = { id: string; name: string; crm_stages: Array<{ id: string; name: string; is_active: boolean; order_index: number }> };
type Profile = { id: string; full_name: string; job_title: string | null; is_active: boolean };

const TRIGGER_SHORT: Record<Automation["trigger_type"], string> = {
  comment: "Comentário", message: "Mensagem", story_reply: "Resposta a story", postback: "Botão",
};

function automationFlow(item: Automation): AutomationFlow {
  return item.flow ?? legacyStepsToFlow({
    triggerType: item.trigger_type, steps: item.steps, crmEnabled: item.crm_enabled,
    crmPipelineId: item.crm_pipeline_id, crmStageId: item.crm_stage_id, crmOriginId: item.crm_origin_id,
    crmAssignedTo: item.crm_assigned_to, crmDealValue: item.crm_deal_value,
  });
}

function blankState(connectionId: string): BuilderState {
  return {
    name: "", connectionId, status: "draft", triggerType: "comment", matchType: "contains",
    keywords: "", publicReplyText: "Te mandei no direct!", flow: starterFlow(),
  };
}

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
  const [initial, setInitial] = useState<BuilderState>(() => blankState(accountId ?? ""));
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
      }
    } catch { toast.error("Não foi possível carregar as automações. Tente atualizar."); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const visibleAutomations = accountId ? automations.filter(item => item.connection_id === accountId) : automations;
  const visibleConnections = useMemo(() => accountId ? connections.filter(item => item.id === accountId) : connections, [accountId, connections]);

  const openNew = useCallback(() => {
    setEditingId(null);
    setInitial(blankState(accountId || connections[0]?.id || ""));
    setEditorOpen(true);
  }, [accountId, connections]);

  useEffect(() => {
    if (!createSignal || createSignal === openedSignal.current || loading || !isAdmin || !connections.length) return;
    openedSignal.current = createSignal;
    openNew();
  }, [connections.length, createSignal, isAdmin, loading, openNew]);

  const edit = (item: Automation) => {
    setEditingId(item.id);
    setInitial({
      name: item.name, connectionId: item.connection_id, status: item.status, triggerType: item.trigger_type,
      matchType: item.match_type, keywords: item.keywords.join("\n"), publicReplyText: item.public_reply_text ?? "",
      flow: automationFlow(item),
    });
    setEditorOpen(true);
  };

  const save = async (state: BuilderState) => {
    setSaving(true);
    const payload = {
      name: state.name, connectionId: state.connectionId, status: state.status,
      triggerType: state.triggerType, matchType: state.matchType, keywords: keywordList(state.keywords),
      publicReplyText: state.triggerType === "comment" ? state.publicReplyText : null,
      steps: [], crmEnabled: false, flow: state.flow,
    };
    try {
      const response = await fetch(editingId ? `/api/marketing/instagram/automations/${editingId}` : "/api/marketing/instagram/automations", {
        method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) toast.error(data.error ?? "Não foi possível salvar");
      else {
        toast.success(editingId ? "Automação atualizada" : "Automação criada");
        setEditorOpen(false); setEditingId(null);
        await load(); window.dispatchEvent(new Event("instagram-publication-updated"));
      }
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
      <div className="ig-auto-heading"><h2>Comentários e Direct</h2><p>Fluxos ativos, métricas e respostas da sua audiência.</p></div>
      {visibleConnections.map(connection => <section key={connection.id} className="mb-5 flex items-start gap-3 rounded-2xl border p-4" style={{ background: "var(--glass-bg-soft)" }}>{connection.webhook_subscribed ? <CheckCircle2 className="mt-0.5 text-emerald-500" size={19} /> : <XCircle className="mt-0.5 text-amber-500" size={19} />}<div><h3 className="text-sm font-semibold">@{connection.username}</h3><p className="text-xs text-[var(--muted-foreground)]">{connection.webhook_subscribed ? "Webhooks de comentários e mensagens assinados" : "Reconecte a conta após liberar as permissões na Meta"}</p>{connection.webhook_error && <p className="mt-1 text-xs text-amber-500">{connection.webhook_error}</p>}</div></section>)}
      <section className="ig-glass p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><span className="ig-eyebrow">SUAS REGRAS</span><h3 className="mt-1 font-semibold">Automações configuradas</h3></div>
          {isAdmin && connections.length > 0 ? <button type="button" className="ig-btn" onClick={openNew}><Webhook size={15} />Novo fluxo</button> : <Webhook size={18} />}
        </div>
        {loading ? <p className="text-sm text-[var(--muted-foreground)]">Carregando automações…</p>
          : !isAdmin && !visibleAutomations.length ? <Notice tone="neutral">Nenhuma automação criada ainda.</Notice>
          : connections.length === 0 ? <Notice tone="warning">Conecte primeiro uma conta profissional na aba Instagram.</Notice>
          : visibleAutomations.length === 0 ? <Notice tone="neutral">Nenhuma automação criada ainda. Crie um fluxo para começar a responder às interações.</Notice>
          : <div className="grid gap-3 md:grid-cols-2">{visibleAutomations.map(item => {
            const flow = automationFlow(item);
            const stats = flowStats(flow);
            return (
              <article key={item.id} className="rounded-2xl border p-4" style={{ background: "var(--glass-bg-soft)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2"><span className={`h-2 w-2 shrink-0 rounded-full ${item.status === "active" ? "bg-emerald-500" : item.status === "paused" ? "bg-amber-500" : "bg-slate-400"}`} /><h4 className="truncate text-sm font-semibold">{item.name}</h4></div>
                    <p className="text-xs text-[var(--muted-foreground)]">{TRIGGER_SHORT[item.trigger_type]} · {item.match_type === "any" ? "qualquer texto" : item.keywords.join(", ")}</p>
                  </div>
                  {isAdmin && <div className="flex items-center gap-2">
                    <button type="button" role="switch" aria-checked={item.status === "active"} aria-label={`${item.status === "active" ? "Pausar" : "Ativar"} ${item.name}`} disabled={togglingId === item.id} onClick={() => void toggle(item)} className="relative h-[22px] w-10 shrink-0 rounded-full transition-colors disabled:opacity-50" style={{ background: item.status === "active" ? "var(--primary)" : "var(--border)" }}><span className="absolute left-0.5 top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-transform" style={{ transform: item.status === "active" ? "translateX(18px)" : "translateX(0)" }} /></button>
                    <button onClick={() => edit(item)} className="rounded-lg p-2 hover:bg-[var(--hover)]" aria-label={`Editar ${item.name}`}><Pencil size={14} /></button>
                    <button onClick={() => remove(item.id)} className="rounded-lg p-2 text-red-400 hover:bg-[var(--hover)]" aria-label={`Excluir ${item.name}`}><Trash2 size={14} /></button>
                  </div>}
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2 text-center"><Metric value={item.metrics.triggers} label="Gatilhos" /><Metric value={item.metrics.messagesSent} label="Ações" /><Metric value={item.metrics.completed} label="Concluídas" /><Metric value={item.metrics.failed} label="Falhas" /></div>
                <FlowMiniMap flow={flow} label={`${stats.blocks} bloco${stats.blocks === 1 ? "" : "s"} · ${stats.messages} mensage${stats.messages === 1 ? "m" : "ns"}${stats.hasBranches ? " · com ramificações" : ""}${stats.hasCrm ? " · CRM" : ""}`} />
              </article>
            );
          })}</div>}
      </section>
      <AutomationFlowBuilder
        open={editorOpen}
        initial={initial}
        editing={Boolean(editingId)}
        connections={visibleConnections}
        pipelines={pipelines}
        profiles={profiles}
        saving={saving}
        onClose={() => { setEditorOpen(false); setEditingId(null); }}
        onSave={state => void save(state)}
      />
    </div>
  );
}

const MINI_ICONS = { trigger: Zap, message: MessageSquareText, delay: Timer, wait_reply: Hourglass, condition: GitBranch } as const;

/** Main path of the flow (first output of each block) as a row of icons. */
function FlowMiniMap({ flow, label }: { flow: AutomationFlow; label: string }) {
  const path: FlowNode[] = [];
  const seen = new Set<string>();
  let current: FlowNode | undefined = flow.nodes.find(node => node.type === "trigger");
  while (current && !seen.has(current.id) && path.length < 7) {
    seen.add(current.id);
    path.push(current);
    const from: FlowNode = current;
    const target: string | null = flow.edges.find(edge => edge.source === from.id)?.target ?? nextNodeId(flow, from.id, "next");
    current = flow.nodes.find(node => node.id === target);
  }
  return (
    <div className="ig-flow-mini" aria-label={label}>
      {path.map((node, index) => {
        const Icon = node.type === "action" ? (node.data.kind === "add_tag" ? Tag : Target) : MINI_ICONS[node.type];
        return (
          <Fragment key={node.id}>
            {index > 0 && <i />}
            <span className={`is-${node.type === "action" ? `action-${node.data.kind}` : node.type}`}><Icon size={12} /></span>
          </Fragment>
        );
      })}
      <small>{label}</small>
    </div>
  );
}

function Metric({ value, label }: { value: number; label: string }) { return <div className="rounded-lg border px-1 py-2"><strong className="block text-sm">{value}</strong><span className="text-[10px] text-[var(--muted-foreground)]">{label}</span></div>; }
function Notice({ children, tone }: { children: React.ReactNode; tone: "warning" | "neutral" }) { return <div className={`rounded-xl border p-4 text-sm ${tone === "warning" ? "border-amber-500/30 text-amber-500" : "text-[var(--muted-foreground)]"}`}>{children}</div>; }
