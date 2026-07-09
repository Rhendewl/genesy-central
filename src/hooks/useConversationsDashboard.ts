"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { useCurrentMember } from "@/context/CurrentMemberContext";
import type {
  ConversationContact,
  ConversationFlow,
  ConversationFlowEdge,
  ConversationFlowLog,
  ConversationFlowNode,
  ConversationFlowRun,
  ConversationInboxItem,
  ConversationMessage,
  ConversationMetrics,
  ConversationThread,
  ConversationWhatsAppAccount,
} from "@/types/conversations";

type ProfileNameRow = { id: string; full_name: string };

export type ConversationFlowFormOption = { id: string; name: string; slug: string | null };
export type ConversationFlowCalendarOption = { id: string; name: string; slug: string | null; status?: string };
export type ConversationFlowStageOption = { id: string; name: string; is_active?: boolean; order_index?: number };
export type ConversationFlowPipelineOption = {
  id: string;
  name: string;
  is_active?: boolean;
  crm_stages?: ConversationFlowStageOption[];
};

export type ConversationFlowResources = {
  forms: ConversationFlowFormOption[];
  calendars: ConversationFlowCalendarOption[];
  pipelines: ConversationFlowPipelineOption[];
};

export interface UseConversationsDashboardReturn {
  accounts: ConversationWhatsAppAccount[];
  inbox: ConversationInboxItem[];
  messages: ConversationMessage[];
  flows: ConversationFlow[];
  metrics: ConversationMetrics;
  resources: ConversationFlowResources;
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createAccount: (sessionName?: string) => Promise<ConversationWhatsAppAccount | null>;
  startConnection: (accountId: string) => Promise<ConversationWhatsAppAccount | null>;
  refreshConnectionStatus: (accountId: string) => Promise<ConversationWhatsAppAccount | null>;
  disconnectAccount: (accountId: string) => Promise<ConversationWhatsAppAccount | null>;
  deleteAccount: (accountId: string) => Promise<boolean>;
  sendMessage: (threadId: string, body: string) => Promise<ConversationMessage | null>;
  createConversation: (input: {
    name?: string;
    phone: string;
    whatsappAccountId?: string | null;
  }) => Promise<ConversationThread | null>;
  createFlow: (input: {
    name: string;
    description?: string;
    triggerType?: string;
    scope?: "team" | "personal";
  }) => Promise<ConversationFlow | null>;
  updateFlowStatus: (
    flowId: string,
    status: ConversationFlow["status"],
  ) => Promise<ConversationFlow | null>;
  deleteFlow: (flowId: string) => Promise<boolean>;
  testFlow: (flowId: string, threadId?: string | null) => Promise<boolean>;
  addFlowNode: (flowId: string, input: {
    nodeType: ConversationFlowNode["node_type"];
    label?: string;
    config?: Record<string, unknown>;
  }) => Promise<ConversationFlowNode | null>;
  updateFlowNode: (flowId: string, nodeId: string, input: {
    label?: string;
    config?: Record<string, unknown>;
    position?: { x?: number; y?: number };
  }) => Promise<ConversationFlowNode | null>;
  deleteFlowNode: (flowId: string, nodeId: string) => Promise<boolean>;
  createFlowEdge: (flowId: string, input: {
    sourceKey: string;
    targetKey: string;
  }) => Promise<ConversationFlowEdge | null>;
  deleteFlowEdge: (flowId: string, edgeId: string) => Promise<boolean>;
}

const emptyMetrics: ConversationMetrics = {
  sent: 0,
  received: 0,
  automationsExecuted: 0,
  automationsCancelled: 0,
  failures: 0,
  responseRate: 0,
  averageResponseMinutes: 0,
  openThreads: 0,
  needsResponse: 0,
};

const emptyResources: ConversationFlowResources = {
  forms: [],
  calendars: [],
  pipelines: [],
};

function toMap<T extends { id: string }>(rows: T[]) {
  return new Map(rows.map((row) => [row.id, row]));
}

function calculateMetrics(
  threads: ConversationThread[],
  messages: ConversationMessage[],
): ConversationMetrics {
  const sent = messages.filter((message) => message.direction === "outbound").length;
  const received = messages.filter((message) => message.direction === "inbound").length;
  const failed = messages.filter((message) => message.status === "failed").length;
  const automationMessages = messages.filter((message) => message.source === "automation" && message.direction === "outbound").length;
  const openThreads = threads.filter((thread) => thread.status === "open" || thread.status === "pending").length;
  const needsResponse = threads.filter((thread) => thread.needs_response).length;
  const responseRate = received > 0 ? Math.round((sent / received) * 100) : 0;

  const responseTimes = threads
    .filter((thread) => thread.last_inbound_at && thread.last_outbound_at)
    .map((thread) => {
      const inbound = new Date(thread.last_inbound_at!).getTime();
      const outbound = new Date(thread.last_outbound_at!).getTime();
      return outbound > inbound ? Math.round((outbound - inbound) / 60000) : null;
    })
    .filter((value): value is number => value != null);

  return {
    sent,
    received,
    automationsExecuted: automationMessages,
    automationsCancelled: 0,
    failures: failed,
    responseRate: Math.min(responseRate, 100),
    averageResponseMinutes: responseTimes.length
      ? Math.round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length)
      : 0,
    openThreads,
    needsResponse,
  };
}

export function useConversationsDashboard(): UseConversationsDashboardReturn {
  const { member, isLoading: memberLoading } = useCurrentMember();
  const [accounts, setAccounts] = useState<ConversationWhatsAppAccount[]>([]);
  const [inbox, setInbox] = useState<ConversationInboxItem[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [flows, setFlows] = useState<ConversationFlow[]>([]);
  const [metrics, setMetrics] = useState<ConversationMetrics>(emptyMetrics);
  const [resources, setResources] = useState<ConversationFlowResources>(emptyResources);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (memberLoading) return;

    try {
      setIsLoading(true);
      setError(null);

      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !member) {
        setAccounts([]);
        setInbox([]);
        setMessages([]);
        setFlows([]);
        setMetrics(emptyMetrics);
        setResources(emptyResources);
        return;
      }

      const [
        accountsRes,
        contactsRes,
        threadsRes,
        profilesRes,
        flowsRes,
        formsFetch,
        calendarsFetch,
        pipelinesFetch,
      ] = await Promise.all([
        supabase
          .from("conversation_whatsapp_accounts")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("conversation_contacts")
          .select("*")
          .order("updated_at", { ascending: false }),
        supabase
          .from("conversation_threads")
          .select("*")
          .order("last_message_at", { ascending: false, nullsFirst: false }),
        supabase
          .from("user_profiles")
          .select("id, full_name"),
        supabase
          .from("conversation_flows")
          .select("*")
          .order("updated_at", { ascending: false }),
        fetch("/api/formularios").then((res) => res.ok ? res.json() : { formularios: [] }).catch(() => ({ formularios: [] })),
        fetch("/api/appointments/calendars").then((res) => res.ok ? res.json() : { calendars: [] }).catch(() => ({ calendars: [] })),
        fetch("/api/crm/pipelines").then((res) => res.ok ? res.json() : { pipelines: [] }).catch(() => ({ pipelines: [] })),
      ]);

      if (accountsRes.error) throw accountsRes.error;
      if (contactsRes.error) throw contactsRes.error;
      if (threadsRes.error) throw threadsRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (flowsRes.error) throw flowsRes.error;

      const nextAccounts = (accountsRes.data ?? []) as ConversationWhatsAppAccount[];
      const contacts = (contactsRes.data ?? []) as ConversationContact[];
      const threads = (threadsRes.data ?? []) as ConversationThread[];
      const profiles = (profilesRes.data ?? []) as ProfileNameRow[];
      const flowRows = (flowsRes.data ?? []) as ConversationFlow[];
      const threadIds = threads.map((thread) => thread.id);
      const flowIds = flowRows.map((flow) => flow.id);

      const [messagesRes, nodesRes, edgesRes, runsRes, logsRes, jobsCancelledRes] = await Promise.all([
        threadIds.length > 0
          ? supabase
              .from("conversation_messages")
              .select("*")
              .in("thread_id", threadIds)
              .order("created_at", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        flowIds.length > 0
          ? supabase
              .from("conversation_flow_nodes")
              .select("*")
              .in("flow_id", flowIds)
              .order("created_at", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        flowIds.length > 0
          ? supabase
              .from("conversation_flow_edges")
              .select("*")
              .in("flow_id", flowIds)
              .order("created_at", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        flowIds.length > 0
          ? supabase
              .from("conversation_flow_runs")
              .select("*")
              .in("flow_id", flowIds)
              .order("started_at", { ascending: false })
              .limit(60)
          : Promise.resolve({ data: [], error: null }),
        flowIds.length > 0
          ? supabase
              .from("conversation_flow_logs")
              .select("*")
              .in("flow_id", flowIds)
              .order("created_at", { ascending: false })
              .limit(80)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("conversation_flow_jobs")
          .select("id", { count: "exact", head: true })
          .eq("status", "cancelled"),
      ]);

      if (messagesRes.error) throw messagesRes.error;
      if (nodesRes.error) throw nodesRes.error;
      if (edgesRes.error) throw edgesRes.error;
      if (runsRes.error) throw runsRes.error;
      if (logsRes.error) throw logsRes.error;

      const nextMessages = (messagesRes.data ?? []) as ConversationMessage[];
      const nodes = (nodesRes.data ?? []) as ConversationFlowNode[];
      const edges = (edgesRes.data ?? []) as ConversationFlowEdge[];
      const runs = (runsRes.data ?? []) as ConversationFlowRun[];
      const logs = (logsRes.data ?? []) as ConversationFlowLog[];
      const contactsById = toMap(contacts);
      const accountsById = toMap(nextAccounts);
      const profilesById = toMap(profiles);

      const nextInbox = threads
        .map((thread): ConversationInboxItem | null => {
          const contact = contactsById.get(thread.contact_id);
          if (!contact) return null;
          const account = thread.whatsapp_account_id ? accountsById.get(thread.whatsapp_account_id) : null;
          const profile = profilesById.get(thread.owner_profile_id);
          return {
            thread,
            contact,
            account: account
              ? {
                  id: account.id,
                  session_name: account.session_name,
                  status: account.status,
                  phone: account.phone,
                }
              : null,
            ownerName: profile?.full_name ?? "Sem responsável",
          };
        })
        .filter((item): item is ConversationInboxItem => item != null);

      const nextFlows = flowRows.map((flow) => ({
        ...flow,
        nodes: nodes.filter((node) => node.flow_id === flow.id),
        edges: edges.filter((edge) => edge.flow_id === flow.id),
        runs: runs.filter((run) => run.flow_id === flow.id).slice(0, 10),
        logs: logs.filter((log) => log.flow_id === flow.id).slice(0, 12),
      }));

      const nextMetrics = calculateMetrics(threads, nextMessages);
      nextMetrics.automationsCancelled = jobsCancelledRes.count ?? 0;

      setAccounts(nextAccounts);
      setInbox(nextInbox);
      setMessages(nextMessages);
      setFlows(nextFlows);
      setMetrics(nextMetrics);
      setResources({
        forms: ((formsFetch.formularios ?? []) as Array<{ id: string; name: string; slug?: string | null }>).map((form) => ({
          id: form.id,
          name: form.name,
          slug: form.slug ?? null,
        })),
        calendars: ((calendarsFetch.calendars ?? []) as Array<{ id: string; name: string; slug?: string | null; status?: string }>).map((calendar) => ({
          id: calendar.id,
          name: calendar.name,
          slug: calendar.slug ?? null,
          status: calendar.status,
        })),
        pipelines: ((pipelinesFetch.pipelines ?? []) as ConversationFlowPipelineOption[]).map((pipeline) => ({
          id: pipeline.id,
          name: pipeline.name,
          is_active: pipeline.is_active,
          crm_stages: (pipeline.crm_stages ?? []).map((stage) => ({
            id: stage.id,
            name: stage.name,
            is_active: stage.is_active,
            order_index: stage.order_index,
          })),
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar conversas");
    } finally {
      setIsLoading(false);
    }
  }, [member, memberLoading]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const createAccount = useCallback(async (sessionName?: string) => {
    if (!member) return null;
    setIsMutating(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error: insertError } = await supabase
        .from("conversation_whatsapp_accounts")
        .insert({
          owner_profile_id: member.id,
          session_name: sessionName?.trim() || `WhatsApp ${new Date().toLocaleDateString("pt-BR")}`,
          provider: "qr_code",
          status: "disconnected",
        })
        .select("*")
        .single();

      if (insertError) throw insertError;
      const account = data as ConversationWhatsAppAccount;
      setAccounts((current) => [account, ...current]);
      return account;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar conta WhatsApp");
      return null;
    } finally {
      setIsMutating(false);
    }
  }, [member]);

  const startConnection = useCallback(async (accountId: string) => {
    setIsMutating(true);
    try {
      const response = await fetch(`/api/conversas/accounts/${accountId}/connection`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error ?? "Erro ao iniciar conexão WhatsApp");

      const account = payload.account as ConversationWhatsAppAccount;
      setAccounts((current) => current.map((item) => item.id === account.id ? account : item));
      return account;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar conexão WhatsApp");
      return null;
    } finally {
      setIsMutating(false);
    }
  }, []);

  const refreshConnectionStatus = useCallback(async (accountId: string) => {
    if (!accountId) return null;

    try {
      const response = await fetch(`/api/conversas/accounts/${accountId}/connection`, {
        method: "GET",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error ?? "Erro ao consultar conexão WhatsApp");

      const account = payload.account as ConversationWhatsAppAccount;
      setAccounts((current) => current.map((item) => item.id === account.id ? account : item));
      return account;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao consultar conexão WhatsApp");
      return null;
    }
  }, []);

  const disconnectAccount = useCallback(async (accountId: string) => {
    setIsMutating(true);
    try {
      const response = await fetch(`/api/conversas/accounts/${accountId}/connection`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error ?? "Erro ao desconectar WhatsApp");

      const account = payload.account as ConversationWhatsAppAccount;
      setAccounts((current) => current.map((item) => item.id === account.id ? account : item));
      return account;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao desconectar WhatsApp");
      return null;
    } finally {
      setIsMutating(false);
    }
  }, []);

  const deleteAccount = useCallback(async (accountId: string) => {
    if (!accountId) return false;

    setIsMutating(true);
    try {
      await fetch(`/api/conversas/accounts/${accountId}/connection`, {
        method: "DELETE",
      }).catch(() => null);

      const supabase = getSupabaseClient();
      const { error: deleteError } = await supabase
        .from("conversation_whatsapp_accounts")
        .delete()
        .eq("id", accountId);

      if (deleteError) throw deleteError;

      setAccounts((current) => current.filter((account) => account.id !== accountId));
      await fetchData();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao apagar conta WhatsApp");
      return false;
    } finally {
      setIsMutating(false);
    }
  }, [fetchData]);

  const sendMessage = useCallback(async (threadId: string, body: string) => {
    const trimmed = body.trim();
    if (!threadId || !trimmed) return null;

    setIsMutating(true);
    try {
      const response = await fetch("/api/conversas/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: threadId, body: trimmed }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Erro ao enviar mensagem");
      }

      const message = payload?.message as ConversationMessage;
      await fetchData();
      return message;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar mensagem");
      return null;
    } finally {
      setIsMutating(false);
    }
  }, [fetchData]);

  const createConversation = useCallback(async (input: {
    name?: string;
    phone: string;
    whatsappAccountId?: string | null;
  }) => {
    if (!input.phone.trim()) return null;

    setIsMutating(true);
    try {
      const response = await fetch("/api/conversas/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: input.name?.trim() || null,
          phone: input.phone.trim(),
          whatsapp_account_id: input.whatsappAccountId || null,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Erro ao criar conversa");
      }

      const thread = payload?.thread as ConversationThread;
      await fetchData();
      return thread;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar conversa");
      return null;
    } finally {
      setIsMutating(false);
    }
  }, [fetchData]);

  const createFlow = useCallback(async (input: {
    name: string;
    description?: string;
    triggerType?: string;
    scope?: "team" | "personal";
  }) => {
    if (!input.name.trim()) return null;

    setIsMutating(true);
    try {
      const response = await fetch("/api/conversas/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: input.name.trim(),
          description: input.description?.trim() || null,
          trigger_type: input.triggerType || "visual_builder",
          scope: input.scope || "team",
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Erro ao criar fluxo");
      }

      const flow = payload?.flow as ConversationFlow;
      await fetchData();
      return flow;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar fluxo");
      return null;
    } finally {
      setIsMutating(false);
    }
  }, [fetchData]);

  const updateFlowStatus = useCallback(async (flowId: string, status: ConversationFlow["status"]) => {
    if (!flowId) return null;

    setIsMutating(true);
    try {
      const response = await fetch(`/api/conversas/flows/${flowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Erro ao atualizar fluxo");
      }

      const flow = payload?.flow as ConversationFlow;
      await fetchData();
      return flow;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar fluxo");
      return null;
    } finally {
      setIsMutating(false);
    }
  }, [fetchData]);

  const deleteFlow = useCallback(async (flowId: string) => {
    if (!flowId) return false;

    setIsMutating(true);
    try {
      const response = await fetch(`/api/conversas/flows/${flowId}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Erro ao apagar fluxo");
      }

      await fetchData();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao apagar fluxo");
      return false;
    } finally {
      setIsMutating(false);
    }
  }, [fetchData]);

  const testFlow = useCallback(async (flowId: string, threadId?: string | null) => {
    if (!flowId) return false;

    setIsMutating(true);
    try {
      const response = await fetch(`/api/conversas/flows/${flowId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: threadId || null }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Erro ao testar fluxo");
      }

      await fetchData();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao testar fluxo");
      return false;
    } finally {
      setIsMutating(false);
    }
  }, [fetchData]);

  const addFlowNode = useCallback(async (flowId: string, input: {
    nodeType: ConversationFlowNode["node_type"];
    label?: string;
    config?: Record<string, unknown>;
  }) => {
    if (!flowId) return null;

    setIsMutating(true);
    try {
      const response = await fetch(`/api/conversas/flows/${flowId}/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node_type: input.nodeType,
          label: input.label?.trim() || null,
          config: input.config ?? {},
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Erro ao adicionar bloco");
      }

      const node = payload?.node as ConversationFlowNode;
      await fetchData();
      return node;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar bloco");
      return null;
    } finally {
      setIsMutating(false);
    }
  }, [fetchData]);

  const deleteFlowNode = useCallback(async (flowId: string, nodeId: string) => {
    if (!flowId || !nodeId) return false;

    setIsMutating(true);
    try {
      const response = await fetch(`/api/conversas/flows/${flowId}/nodes`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ node_id: nodeId }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Erro ao apagar bloco");
      }

      await fetchData();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao apagar bloco");
      return false;
    } finally {
      setIsMutating(false);
    }
  }, [fetchData]);

  const updateFlowNode = useCallback(async (flowId: string, nodeId: string, input: {
    label?: string;
    config?: Record<string, unknown>;
    position?: { x?: number; y?: number };
  }) => {
    if (!flowId || !nodeId) return null;

    setIsMutating(true);
    try {
      const response = await fetch(`/api/conversas/flows/${flowId}/nodes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node_id: nodeId,
          label: input.label?.trim() || null,
          config: input.config ?? null,
          position: input.position ?? null,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Erro ao atualizar bloco");
      }

      const node = payload?.node as ConversationFlowNode;
      await fetchData();
      return node;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar bloco");
      return null;
    } finally {
      setIsMutating(false);
    }
  }, [fetchData]);

  const createFlowEdge = useCallback(async (flowId: string, input: {
    sourceKey: string;
    targetKey: string;
  }) => {
    if (!flowId || !input.sourceKey || !input.targetKey) return null;

    setIsMutating(true);
    try {
      const response = await fetch(`/api/conversas/flows/${flowId}/edges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_key: input.sourceKey,
          target_key: input.targetKey,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Erro ao criar conexão");
      }

      const edge = payload?.edge as ConversationFlowEdge;
      await fetchData();
      return edge;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar conexão");
      return null;
    } finally {
      setIsMutating(false);
    }
  }, [fetchData]);

  const deleteFlowEdge = useCallback(async (flowId: string, edgeId: string) => {
    if (!flowId || !edgeId) return false;

    setIsMutating(true);
    try {
      const response = await fetch(`/api/conversas/flows/${flowId}/edges`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edge_id: edgeId }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Erro ao apagar conexão");
      }

      await fetchData();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao apagar conexão");
      return false;
    } finally {
      setIsMutating(false);
    }
  }, [fetchData]);

  return useMemo(() => ({
    accounts,
    inbox,
    messages,
    flows,
    metrics,
    resources,
    isLoading,
    isMutating,
    error,
    refetch: fetchData,
    createAccount,
    startConnection,
    refreshConnectionStatus,
    disconnectAccount,
    deleteAccount,
    sendMessage,
    createConversation,
    createFlow,
    updateFlowStatus,
    deleteFlow,
    testFlow,
    addFlowNode,
    updateFlowNode,
    deleteFlowNode,
    createFlowEdge,
    deleteFlowEdge,
  }), [
    accounts,
    inbox,
    messages,
    flows,
    metrics,
    resources,
    isLoading,
    isMutating,
    error,
    fetchData,
    createAccount,
    startConnection,
    refreshConnectionStatus,
    disconnectAccount,
    deleteAccount,
    sendMessage,
    createConversation,
    createFlow,
    updateFlowStatus,
    deleteFlow,
    testFlow,
    addFlowNode,
    updateFlowNode,
    deleteFlowNode,
    createFlowEdge,
    deleteFlowEdge,
  ]);
}
