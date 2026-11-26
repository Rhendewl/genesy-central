"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, BarChart3, GitBranch, Hourglass, MessageSquareText, Pencil, Tag, Target, Timer, Trash2, Webhook, Workflow, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  AutomationFlowBuilder,
  keywordList,
  starterFlow,
  type BuilderState,
} from "@/components/marketing/instagram/AutomationFlowBuilder";
import { AutomationInsights, Ring } from "@/components/marketing/instagram/AutomationInsights";
import { PostStack } from "@/components/marketing/instagram/AutomationPostPicker";
import "@/components/marketing/instagram/automation-insights.css";
import { flowStats, legacyStepsToFlow, nextNodeId, type AutomationFlow, type FlowNode } from "@/lib/instagram-automation/flow";

type Step = { type: "message"; text: string; delayMinutes: number; button?: { label: string; url: string } | null };
type Automation = {
  id: string; connection_id: string; name: string; status: "draft" | "active" | "paused";
  trigger_type: "comment" | "message" | "story_reply" | "postback";
  match_type: "contains" | "exact" | "starts_with" | "any"; keywords: string[]; media_ids?: string[] | null;
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
    keywords: "", publicReplyText: "Te mandei no direct!", postScope: "all", mediaIds: [], flow: starterFlow(),
  };
}

export function InstagramAutomations({ accountId, createSignal = 0 }: { accountId?: string; createSignal?: number }) {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  // "isAdmin" = pode criar/editar fluxos (admin ou dono das contas exibidas).
  const [isAdmin, setIsAdmin] = useState(false);
  const [canUseCrm, setCanUseCrm] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [initial, setInitial] = useState<BuilderState>(() => blankState(accountId ?? ""));
  const [view, setView] = useState<"flows" | "insights">("flows");
  const [insightsId, setInsightsId] = useState<string | null>(null);
  const openedSignal = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/marketing/instagram/automations", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) toast.error(data.error ?? "Não foi possível carregar as automações");
      else {
        setAutomations(data.automations ?? []); setConnections(data.connections ?? []);
        setPipelines(data.pipelines ?? []); setIsAdmin(Boolean(data.can_manage ?? data.is_admin));
        setCanUseCrm(data.can_use_crm ?? true);
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
      postScope: (item.media_ids ?? []).length ? "specific" : "all", mediaIds: item.media_ids ?? [],
      flow: automationFlow(item),
    });
    setEditorOpen(true);
  };

  const save = async (state: BuilderState) => {
    setSaving(true);
    const payload = {
      name: state.name, connectionId: state.connectionId, status: state.status,
      triggerType: state.triggerType, matchType: state.matchType, keywords: keywordList(state.keywords),
      mediaIds: state.triggerType === "comment" && state.postScope === "specific" ? state.mediaIds : [],
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
    <div className="ig-auto-shell pb-10">
      <div className="ig-auto-heading"><h2>Comentários e Direct</h2><p>Fluxos ativos, métricas e respostas da sua audiência.</p></div>
      <div className="ig-auto-tabs" role="tablist" aria-label="Automações">
        <button type="button" role="tab" aria-selected={view === "flows"} onClick={() => setView("flows")}><Workflow size={14} />Fluxos</button>
        <button type="button" role="tab" aria-selected={view === "insights"} onClick={() => setView("insights")}><BarChart3 size={14} />Insights</button>
      </div>
      {view === "insights" ? (
        <AutomationInsights automations={visibleAutomations} initialId={insightsId} />
      ) : (
      <section className="ig-glass p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><span className="ig-eyebrow">SEUS FLUXOS</span><h3 className="mt-1 font-semibold">Automações configuradas</h3></div>
          {isAdmin && connections.length > 0 ? <button type="button" className="ig-btn" onClick={openNew}><Webhook size={15} />Novo fluxo</button> : <Webhook size={18} />}
        </div>
        {loading ? <p className="text-sm text-[var(--muted-foreground)]">Carregando automações…</p>
          : !isAdmin && !visibleAutomations.length ? <Notice tone="neutral">Nenhuma automação criada ainda.</Notice>
          : connections.length === 0 ? <Notice tone="warning">Conecte primeiro uma conta profissional na aba Instagram.</Notice>
          : visibleAutomations.length === 0 ? <Notice tone="neutral">Nenhuma automação criada ainda. Crie um fluxo para começar a responder às interações.</Notice>
          : <div className="ig-flow-cards">{visibleAutomations.map(item => {
            const flow = automationFlow(item);
            const stats = flowStats(flow);
            const { triggers, completed, failed, messagesSent } = item.metrics;
            const rate = triggers ? completed / triggers : 0;
            const keywords = item.match_type === "any" ? [item.trigger_type === "comment" ? "qualquer comentário" : "qualquer texto"] : item.keywords;
            return (
              <article key={item.id} className={`ig-flow-card is-${item.status}`}>
                <div className="ig-flow-card-top">
                  <span className="ig-flow-card-status"><i />{item.status === "active" ? "Ativa" : item.status === "paused" ? "Pausada" : "Rascunho"}</span>
                  {isAdmin && <div className="ig-flow-card-actions">
                    <button type="button" role="switch" aria-checked={item.status === "active"} aria-label={`${item.status === "active" ? "Pausar" : "Ativar"} ${item.name}`} disabled={togglingId === item.id} onClick={() => void toggle(item)} className="relative mr-1 h-[22px] w-10 shrink-0 rounded-full transition-colors disabled:opacity-50" style={{ background: item.status === "active" ? "var(--primary)" : "var(--border)" }}><span className="absolute left-0.5 top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-transform" style={{ transform: item.status === "active" ? "translateX(18px)" : "translateX(0)" }} /></button>
                    <button type="button" onClick={() => edit(item)} aria-label={`Editar ${item.name}`} title="Editar fluxo"><Pencil size={14} /></button>
                    <button type="button" onClick={() => remove(item.id)} aria-label={`Excluir ${item.name}`} title="Excluir" className="hover:!text-red-400"><Trash2 size={14} /></button>
                  </div>}
                </div>
                <div>
                  <h4>{item.name}</h4>
                  <p className="ig-flow-card-trigger">
                    {TRIGGER_SHORT[item.trigger_type]}
                    {item.trigger_type === "comment" && (item.media_ids ?? []).length > 0 && (
                      <span className="ig-flow-card-posts" title="Só nesses posts">
                        <PostStack connectionId={item.connection_id} ids={(item.media_ids ?? []).slice(0, 3)} size={20} max={3} />
                        {(item.media_ids ?? []).length === 1 ? "1 post" : `${(item.media_ids ?? []).length} posts`}
                      </span>
                    )}
                    {keywords.slice(0, 3).map(keyword => <em key={keyword}>{keyword}</em>)}
                    {keywords.length > 3 && <em>+{keywords.length - 3}</em>}
                  </p>
                </div>
                <div className="ig-flow-card-hero">
                  <div><strong>{triggers.toLocaleString("pt-BR")}</strong><span>pessoas entraram no fluxo</span></div>
                  <div className="ig-flow-card-rate">
                    <div><b>{Math.round(rate * 100)}%</b><small>concluíram</small></div>
                    <Ring value={rate} size={46} />
                  </div>
                </div>
                <div className="ig-flow-card-stats">
                  <span title="Pessoas que chegaram ao fim do fluxo"><b>{completed.toLocaleString("pt-BR")}</b><small>Concluíram</small></span>
                  <span title="Mensagens, respostas e ações de CRM enviadas"><b>{messagesSent.toLocaleString("pt-BR")}</b><small>Envios realizados</small></span>
                  <span className={failed ? "is-warn" : ""} title="Execuções com erro de envio"><b>{failed.toLocaleString("pt-BR")}</b><small>Com falha</small></span>
                </div>
                <div className="ig-flow-card-foot">
                  <FlowMiniMap flow={flow} label={`${stats.blocks} bloco${stats.blocks === 1 ? "" : "s"}${stats.hasBranches ? " · ramificado" : ""}${stats.hasCrm ? " · CRM" : ""}`} />
                  <button type="button" className="ig-text-link" onClick={() => { setInsightsId(item.id); setView("insights"); }}>Ver insights <ArrowUpRight size={13} /></button>
                </div>
              </article>
            );
          })}</div>}
      </section>
      )}
      <AutomationFlowBuilder
        open={editorOpen}
        initial={initial}
        editing={Boolean(editingId)}
        connections={visibleConnections}
        pipelines={pipelines}
        profiles={profiles}
        canUseCrm={canUseCrm}
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
  while (current && !seen.has(current.id) && path.length < 5) {
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
        // The fifth icon fades out: it hints that the flow keeps going.
        const fading = index === 4;
        return (
          <Fragment key={node.id}>
            {index > 0 && <i className={fading ? "is-fading" : undefined} />}
            <span className={`is-${node.type === "action" ? `action-${node.data.kind}` : node.type}${fading ? " is-fading" : ""}`}><Icon size={12} /></span>
          </Fragment>
        );
      })}
      <small>{label}</small>
    </div>
  );
}

function Notice({ children, tone }: { children: React.ReactNode; tone: "warning" | "neutral" }) { return <div className={`rounded-xl border p-4 text-sm ${tone === "warning" ? "border-amber-500/30 text-amber-500" : "text-[var(--muted-foreground)]"}`}>{children}</div>; }
