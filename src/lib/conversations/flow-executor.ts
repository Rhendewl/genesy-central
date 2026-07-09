import { getWhatsAppProvider } from "@/lib/conversations/providers";
import type { ConversationMessage } from "@/types/conversations";

type Db = ReturnType<typeof import("@/lib/supabase-admin").createAdminSupabaseClient>;

type FlowJobRow = {
  id: string;
  user_id: string;
  flow_id: string;
  node_id: string | null;
  lead_id: string | null;
  thread_id: string | null;
  whatsapp_account_id: string | null;
  owner_profile_id: string | null;
  status: string;
  trigger_event_type: string;
  trigger_snapshot: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
};

type FlowRow = {
  id: string;
  user_id: string;
  status: "draft" | "active" | "paused" | "archived";
};

type FlowNodeRow = {
  id: string;
  node_key: string;
  node_type: "trigger" | "condition" | "wait" | "action" | "end";
  label: string;
  config: Record<string, unknown>;
};

type FlowEdgeRow = {
  source_key: string;
  target_key: string;
};

type ThreadRow = {
  id: string;
  user_id: string;
  whatsapp_account_id: string | null;
  contact_id: string;
  owner_profile_id: string;
  lead_id: string | null;
};

type ContactRow = {
  id: string;
  phone: string;
};

type AccountRow = {
  id: string;
  provider: "qr_code" | "cloud_api";
};

function asConfig(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function getSnapshotString(snapshot: Record<string, unknown>, field: string) {
  const value = snapshot[field] ?? snapshot.body ?? snapshot.message_body ?? "";
  return typeof value === "string" ? value : String(value ?? "");
}

function getNextNode(currentKey: string, nodesByKey: Map<string, FlowNodeRow>, edges: FlowEdgeRow[]) {
  const edge = edges.find((item) => item.source_key === currentKey);
  return edge ? nodesByKey.get(edge.target_key) ?? null : null;
}

export class ConversationFlowExecutor {
  constructor(private readonly db: Db) {}

  async runDueJobs(limit = 20) {
    const now = new Date().toISOString();
    const { data: jobs, error } = await this.db
      .from("conversation_flow_jobs")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", now)
      .order("scheduled_for", { ascending: true })
      .limit(limit);

    if (error) {
      return { ok: false, processed: 0, failed: 0, error: error.message };
    }

    let processed = 0;
    let failed = 0;

    for (const job of (jobs ?? []) as FlowJobRow[]) {
      const result = await this.runJob(job);
      processed += result.processed ? 1 : 0;
      failed += result.failed ? 1 : 0;
    }

    return { ok: true, processed, failed };
  }

  private async runJob(job: FlowJobRow) {
    const startedAt = new Date().toISOString();
    const { data: run } = await this.db
      .from("conversation_flow_runs")
      .insert({
        user_id: job.user_id,
        flow_id: job.flow_id,
        job_id: job.id,
        lead_id: job.lead_id,
        thread_id: job.thread_id,
        status: "failed",
        snapshot: job.trigger_snapshot ?? {},
        started_at: startedAt,
      })
      .select("id")
      .single();

    await this.db
      .from("conversation_flow_jobs")
      .update({ status: "processing", attempts: job.attempts + 1 })
      .eq("id", job.id);

    try {
      const { data: flow } = await this.db
        .from("conversation_flows")
        .select("id,user_id,status")
        .eq("id", job.flow_id)
        .maybeSingle<FlowRow>();

      if (!flow || flow.status !== "active") {
        await this.cancelJob(job, run?.id ?? null, "Fluxo não está ativo.");
        return { processed: true, failed: false };
      }

      const [{ data: nodes }, { data: edges }] = await Promise.all([
        this.db
          .from("conversation_flow_nodes")
          .select("id,node_key,node_type,label,config")
          .eq("flow_id", flow.id)
          .order("created_at", { ascending: true }),
        this.db
          .from("conversation_flow_edges")
          .select("source_key,target_key")
          .eq("flow_id", flow.id)
          .order("created_at", { ascending: true }),
      ]);

      const nodeRows = ((nodes ?? []) as FlowNodeRow[]).map((node) => ({
        ...node,
        config: asConfig(node.config),
      }));
      const edgeRows = (edges ?? []) as FlowEdgeRow[];
      const nodesByKey = new Map(nodeRows.map((node) => [node.node_key, node]));
      const currentNode = job.node_id
        ? nodeRows.find((node) => node.id === job.node_id) ?? nodesByKey.get("trigger") ?? null
        : nodesByKey.get("trigger") ?? null;
      let nextNode = currentNode ? getNextNode(currentNode.node_key, nodesByKey, edgeRows) : null;

      while (nextNode) {
        if (nextNode.node_type === "end") {
          await this.finishJob(job, run?.id ?? null, "executed");
          return { processed: true, failed: false };
        }

        if (nextNode.node_type === "condition") {
          if (!this.evaluateCondition(nextNode, job.trigger_snapshot ?? {})) {
            await this.cancelJob(job, run?.id ?? null, `Condição não atendida: ${nextNode.label}`);
            return { processed: true, failed: false };
          }
        }

        if (nextNode.node_type === "wait") {
          const waitUnit = typeof nextNode.config.wait_unit === "string" ? nextNode.config.wait_unit : "minutes";
          const waitValue = Number(nextNode.config.wait_value ?? nextNode.config.wait_minutes ?? 0);
          const delayMs = waitUnit === "seconds"
            ? Math.max(waitValue, 0) * 1000
            : Math.max(waitValue, 0) * 60000;
          const scheduledFor = new Date(Date.now() + delayMs).toISOString();
          await this.db
            .from("conversation_flow_jobs")
            .update({
              status: "pending",
              node_id: nextNode.id,
              scheduled_for: scheduledFor,
            })
            .eq("id", job.id);
          await this.log(job, run?.id ?? null, "info", `Job reagendado por ${waitValue} ${waitUnit === "seconds" ? "segundo(s)" : "minuto(s)"}.`);
          return { processed: true, failed: false };
        }

        if (nextNode.node_type === "action") {
          await this.executeAction(job, nextNode, run?.id ?? null);
        }

        nextNode = getNextNode(nextNode.node_key, nodesByKey, edgeRows);
      }

      await this.finishJob(job, run?.id ?? null, "executed");
      return { processed: true, failed: false };
    } catch (err) {
      const error = err instanceof Error ? err.message : "Erro desconhecido ao executar fluxo.";
      await this.failJob(job, run?.id ?? null, error);
      return { processed: true, failed: true };
    }
  }

  private evaluateCondition(node: FlowNodeRow, snapshot: Record<string, unknown>) {
    const field = typeof node.config.field === "string" ? node.config.field : "message_body";
    const expected = typeof node.config.value === "string" ? node.config.value : "";
    const actual = getSnapshotString(snapshot, field);
    return expected ? actual.toLowerCase().includes(expected.toLowerCase()) : true;
  }

  private async executeAction(job: FlowJobRow, node: FlowNodeRow, runId: string | null) {
    const actionType = typeof node.config.action_type === "string" ? node.config.action_type : "send_message";
    if (actionType === "move_crm") {
      await this.moveLead(job, node, runId);
      return;
    }
    if (actionType !== "send_message") return;

    const message = typeof node.config.message === "string" ? node.config.message.trim() : "";
    const mediaType = typeof node.config.media_type === "string" ? node.config.media_type : "none";
    const mediaUrl = typeof node.config.media_url === "string" ? node.config.media_url.trim() : "";
    if ((!message && !mediaUrl) || !job.thread_id) return;

    const { data: thread } = await this.db
      .from("conversation_threads")
      .select("id,user_id,whatsapp_account_id,contact_id,owner_profile_id,lead_id")
      .eq("id", job.thread_id)
      .maybeSingle<ThreadRow>();
    if (!thread) throw new Error("Thread do job não encontrada.");

    const [{ data: contact }, { data: account }] = await Promise.all([
      this.db
        .from("conversation_contacts")
        .select("id,phone")
        .eq("id", thread.contact_id)
        .maybeSingle<ContactRow>(),
      thread.whatsapp_account_id
        ? this.db
            .from("conversation_whatsapp_accounts")
            .select("id,provider")
            .eq("id", thread.whatsapp_account_id)
            .maybeSingle<AccountRow>()
        : Promise.resolve({ data: null }),
    ]);
    if (!contact) throw new Error("Contato do job não encontrado.");

    const now = new Date().toISOString();
    const { data: queuedMessage, error: insertError } = await this.db
      .from("conversation_messages")
      .insert({
        user_id: thread.user_id,
        thread_id: thread.id,
        whatsapp_account_id: thread.whatsapp_account_id,
        contact_id: thread.contact_id,
        owner_profile_id: thread.owner_profile_id,
        lead_id: thread.lead_id,
        direction: "outbound",
        source: "automation",
        body: message,
        status: "queued",
        flow_id: job.flow_id,
        flow_job_id: job.id,
        sent_at: now,
      })
      .select("*")
      .single<ConversationMessage>();
    if (insertError || !queuedMessage) throw new Error(insertError?.message ?? "Erro ao registrar mensagem automática.");

    let finalStatus: ConversationMessage["status"] = "failed";
    let providerMessageId: string | null = null;
    let providerError = "Nenhuma conta WhatsApp vinculada a esta conversa.";

    if (account) {
      const provider = getWhatsAppProvider(account.provider);
      const result = await provider.sendMessage({
        accountId: account.id,
        to: contact.phone,
        body: message,
        mediaType,
        mediaUrl: mediaUrl || undefined,
        idempotencyKey: queuedMessage.id,
      });
      finalStatus = result.ok ? "sent" : "failed";
      providerMessageId = result.providerMessageId ?? null;
      providerError = result.error ?? (result.ok ? "" : "Falha ao enviar mensagem.");
    }

    await this.db
      .from("conversation_messages")
      .update({
        status: finalStatus,
        provider_message_id: providerMessageId,
        error: providerError || null,
        sent_at: now,
      })
      .eq("id", queuedMessage.id);

    await this.db
      .from("conversation_threads")
      .update({
        last_message_preview: message,
        last_message_at: now,
        last_outbound_at: now,
        needs_response: false,
      })
      .eq("id", thread.id);

    await this.log(job, runId, finalStatus === "sent" ? "info" : "warning", providerError || `Mensagem enviada pelo bloco ${node.label}.`);
  }

  private async moveLead(job: FlowJobRow, node: FlowNodeRow, runId: string | null) {
    const stageId = typeof node.config.stage_id === "string" ? node.config.stage_id : "";
    if (!stageId || !job.lead_id) return;

    const { data, error } = await this.db.rpc("crm_move_lead", {
      p_lead_id: job.lead_id,
      p_stage_id: stageId,
      p_note: `Movido automaticamente pelo fluxo ${node.label}`,
      p_moved_by: job.owner_profile_id,
    });

    if (error) throw new Error(error.message);
    if (!data) throw new Error("Falha ao mover lead no CRM.");

    await this.log(job, runId, "info", `Lead movido pelo bloco ${node.label}.`);
  }

  private async finishJob(job: FlowJobRow, runId: string | null, status: "executed" | "failed") {
    const now = new Date().toISOString();
    await this.db
      .from("conversation_flow_jobs")
      .update({ status, executed_at: now, last_error: null })
      .eq("id", job.id);
    if (runId) {
      await this.db
        .from("conversation_flow_runs")
        .update({ status, finished_at: now })
        .eq("id", runId);
    }
    await this.log(job, runId, "info", status === "executed" ? "Fluxo executado." : "Fluxo finalizado com falha.");
  }

  private async cancelJob(job: FlowJobRow, runId: string | null, reason: string) {
    const now = new Date().toISOString();
    await this.db
      .from("conversation_flow_jobs")
      .update({ status: "cancelled", cancelled_reason: reason, executed_at: now })
      .eq("id", job.id);
    if (runId) {
      await this.db
        .from("conversation_flow_runs")
        .update({ status: "cancelled", reason, finished_at: now })
        .eq("id", runId);
    }
    await this.log(job, runId, "info", reason);
  }

  private async failJob(job: FlowJobRow, runId: string | null, error: string) {
    const now = new Date().toISOString();
    await this.db
      .from("conversation_flow_jobs")
      .update({ status: "failed", last_error: error, executed_at: now })
      .eq("id", job.id);
    if (runId) {
      await this.db
        .from("conversation_flow_runs")
        .update({ status: "failed", reason: error, finished_at: now })
        .eq("id", runId);
    }
    await this.log(job, runId, "error", error);
  }

  private async log(job: FlowJobRow, runId: string | null, level: "info" | "warning" | "error", message: string) {
    await this.db
      .from("conversation_flow_logs")
      .insert({
        user_id: job.user_id,
        flow_id: job.flow_id,
        job_id: job.id,
        run_id: runId,
        level,
        message,
      });
  }
}
