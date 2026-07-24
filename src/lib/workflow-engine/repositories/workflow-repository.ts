import type { Db, DelayType } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// WorkflowRepository — acesso bruto às 6 tabelas do motor. Nenhuma regra de
// negócio aqui (isso vive em WorkflowService/JobScheduler/JobExecutor/
// JobCanceller) — só leitura/escrita.
// ─────────────────────────────────────────────────────────────────────────────

export interface AutomationRow {
  id:             string;
  user_id:        string;
  pipeline_id:    string;
  name:           string;
  status:         "ativa" | "pausada";
  trigger_type:   string;
  trigger_config: Record<string, unknown>;
  delay_type:     DelayType;
  delay_config:   Record<string, unknown>;
  created_at:     string;
  updated_at:     string;
}

export interface ConditionRow {
  id:               string;
  automation_id:    string;
  condition_type:   string;
  condition_config: Record<string, unknown>;
  order_index:      number;
}

export interface ActionRow {
  id:            string;
  automation_id: string;
  action_type:   string;
  action_config: Record<string, unknown>;
  order_index:   number;
}

export interface JobRow {
  id:               string;
  user_id:          string;
  automation_id:    string;
  lead_id:          string;
  status:           "pending" | "processing" | "executed" | "cancelled" | "failed";
  scheduled_for:    string;
  trigger_snapshot: Record<string, unknown>;
  attempts:         number;
  max_attempts:     number;
  last_error:       string | null;
  cancelled_reason: string | null;
  created_at:       string;
  executed_at:      string | null;
}

const AUTOMATION_COLUMNS = "id, user_id, pipeline_id, name, status, trigger_type, trigger_config, delay_type, delay_config, created_at, updated_at";
const CONDITION_COLUMNS  = "id, automation_id, condition_type, condition_config, order_index";
const ACTION_COLUMNS     = "id, automation_id, action_type, action_config, order_index";
const JOB_COLUMNS        = "id, user_id, automation_id, lead_id, status, scheduled_for, trigger_snapshot, attempts, max_attempts, last_error, cancelled_reason, created_at, executed_at";

export class WorkflowRepository {
  constructor(private readonly db: Db) {}

  // ── Automations ─────────────────────────────────────────────────────────────

  async listAutomationsByPipeline(pipelineId: string): Promise<AutomationRow[]> {
    const { data } = await this.db
      .from("workflow_automations")
      .select(AUTOMATION_COLUMNS)
      .eq("pipeline_id", pipelineId)
      .order("created_at", { ascending: false });
    return (data as AutomationRow[]) ?? [];
  }

  async getAutomation(id: string): Promise<AutomationRow | null> {
    const { data } = await this.db
      .from("workflow_automations")
      .select(AUTOMATION_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    return (data as AutomationRow) ?? null;
  }

  /** Automações ativas de uma pipeline com um trigger_type específico — usado pelo consumer do EventBus. */
  async listActiveByPipelineAndTrigger(pipelineId: string, triggerType: string): Promise<AutomationRow[]> {
    const { data } = await this.db
      .from("workflow_automations")
      .select(AUTOMATION_COLUMNS)
      .eq("pipeline_id", pipelineId)
      .eq("trigger_type", triggerType)
      .eq("status", "ativa");
    return (data as AutomationRow[]) ?? [];
  }

  async createAutomation(input: {
    pipelineId:    string;
    name:          string;
    status:        "ativa" | "pausada";
    triggerType:   string;
    triggerConfig: Record<string, unknown>;
    delayType:     DelayType;
    delayConfig:   Record<string, unknown>;
  }): Promise<{ id: string | null; error: string | null }> {
    const { data, error } = await this.db
      .from("workflow_automations")
      .insert({
        pipeline_id:    input.pipelineId,
        name:           input.name,
        status:         input.status,
        trigger_type:   input.triggerType,
        trigger_config: input.triggerConfig,
        delay_type:     input.delayType,
        delay_config:   input.delayConfig,
      })
      .select("id")
      .single();
    if (error) return { id: null, error: error.message };
    return { id: (data as { id: string }).id, error: null };
  }

  async updateAutomation(id: string, patch: Partial<{
    name: string; status: "ativa" | "pausada";
    triggerType: string; triggerConfig: Record<string, unknown>;
    delayType: DelayType; delayConfig: Record<string, unknown>;
  }>): Promise<{ error: string | null }> {
    const dbPatch: Record<string, unknown> = {};
    if (patch.name           !== undefined) dbPatch.name           = patch.name;
    if (patch.status         !== undefined) dbPatch.status         = patch.status;
    if (patch.triggerType    !== undefined) dbPatch.trigger_type   = patch.triggerType;
    if (patch.triggerConfig  !== undefined) dbPatch.trigger_config = patch.triggerConfig;
    if (patch.delayType      !== undefined) dbPatch.delay_type     = patch.delayType;
    if (patch.delayConfig    !== undefined) dbPatch.delay_config   = patch.delayConfig;

    const { error } = await this.db.from("workflow_automations").update(dbPatch).eq("id", id);
    return { error: error?.message ?? null };
  }

  async deleteAutomation(id: string): Promise<{ error: string | null }> {
    const { error } = await this.db.from("workflow_automations").delete().eq("id", id);
    return { error: error?.message ?? null };
  }

  // ── Conditions / Actions ─────────────────────────────────────────────────────

  async listConditions(automationId: string): Promise<ConditionRow[]> {
    const { data } = await this.db
      .from("workflow_conditions")
      .select(CONDITION_COLUMNS)
      .eq("automation_id", automationId)
      .order("order_index");
    return (data as ConditionRow[]) ?? [];
  }

  async listActions(automationId: string): Promise<ActionRow[]> {
    const { data } = await this.db
      .from("workflow_actions")
      .select(ACTION_COLUMNS)
      .eq("automation_id", automationId)
      .order("order_index");
    return (data as ActionRow[]) ?? [];
  }

  async replaceConditions(automationId: string, conditions: { type: string; config: Record<string, unknown> }[]): Promise<{ error: string | null }> {
    const { error: delErr } = await this.db.from("workflow_conditions").delete().eq("automation_id", automationId);
    if (delErr) return { error: delErr.message };
    if (conditions.length === 0) return { error: null };

    const { error: insErr } = await this.db.from("workflow_conditions").insert(
      conditions.map((c, i) => ({
        automation_id:    automationId,
        condition_type:   c.type,
        condition_config: c.config,
        order_index:      i,
      })),
    );
    return { error: insErr?.message ?? null };
  }

  async replaceActions(automationId: string, actions: { type: string; config: Record<string, unknown> }[]): Promise<{ error: string | null }> {
    const { error: delErr } = await this.db.from("workflow_actions").delete().eq("automation_id", automationId);
    if (delErr) return { error: delErr.message };
    if (actions.length === 0) return { error: null };

    const { error: insErr } = await this.db.from("workflow_actions").insert(
      actions.map((a, i) => ({
        automation_id: automationId,
        action_type:   a.type,
        action_config: a.config,
        order_index:   i,
      })),
    );
    return { error: insErr?.message ?? null };
  }

  // ── Jobs ──────────────────────────────────────────────────────────────────

  async insertJob(input: {
    userId:       string;
    automationId: string;
    leadId:       string;
    scheduledFor: Date;
    snapshot:     Record<string, unknown>;
  }): Promise<{ id: string | null; error: string | null }> {
    const { data, error } = await this.db
      .from("workflow_jobs")
      .insert({
        user_id:          input.userId,
        automation_id:    input.automationId,
        lead_id:          input.leadId,
        scheduled_for:    input.scheduledFor.toISOString(),
        trigger_snapshot: input.snapshot,
      })
      .select("id")
      .single();
    if (error) return { id: null, error: error.message };
    return { id: (data as { id: string }).id, error: null };
  }

  /**
   * Reivindica até `limit` jobs pendentes e vencidos, marcando-os como
   * 'processing'. Não usa uma única transação SQL explícita (o cliente
   * Supabase JS não expõe FOR UPDATE SKIP LOCKED diretamente) — em vez
   * disso, o UPDATE...WHERE status='pending' é atômico por linha no Postgres
   * e o `.select()` do retorno só inclui as linhas efetivamente atualizadas
   * por ESTA chamada, o que é suficiente para não processar o mesmo job
   * duas vezes mesmo com dois ticks de cron sobrepostos.
   */
  async claimDueJobs(limit: number): Promise<JobRow[]> {
    const { data: due } = await this.db
      .from("workflow_jobs")
      .select("id")
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .order("scheduled_for")
      .limit(limit);

    const ids = ((due as { id: string }[]) ?? []).map(j => j.id);
    if (ids.length === 0) return [];

    const { data: claimed } = await this.db
      .from("workflow_jobs")
      .update({ status: "processing" })
      .in("id", ids)
      .eq("status", "pending")
      .select(JOB_COLUMNS);

    return (claimed as JobRow[]) ?? [];
  }

  async claimDueJobById(id: string): Promise<JobRow | null> {
    const { data } = await this.db
      .from("workflow_jobs")
      .update({ status: "processing" })
      .eq("id", id)
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .select(JOB_COLUMNS)
      .maybeSingle();

    return (data as JobRow | null) ?? null;
  }

  async getPendingJobsForLead(leadId: string): Promise<JobRow[]> {
    const { data } = await this.db
      .from("workflow_jobs")
      .select(JOB_COLUMNS)
      .eq("lead_id", leadId)
      .eq("status", "pending");
    return (data as JobRow[]) ?? [];
  }

  async markJobExecuted(id: string): Promise<void> {
    await this.db.from("workflow_jobs").update({ status: "executed", executed_at: new Date().toISOString() }).eq("id", id);
  }

  async markJobCancelled(id: string, reason: string): Promise<void> {
    await this.db.from("workflow_jobs").update({ status: "cancelled", cancelled_reason: reason }).eq("id", id);
  }

  async markJobFailed(id: string, error: string, attempts: number, maxAttempts: number): Promise<void> {
    await this.db.from("workflow_jobs").update({
      status:     attempts >= maxAttempts ? "failed" : "pending",
      last_error: error,
      attempts,
    }).eq("id", id);
  }

  // ── Execution log ─────────────────────────────────────────────────────────

  async logExecution(input: {
    userId:       string;
    jobId:        string;
    automationId: string;
    leadId:       string;
    status:       "executada" | "cancelada" | "falhou";
    reason?:      string;
    renderedActionSnapshot?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.from("workflow_execution_log").insert({
      user_id:                  input.userId,
      job_id:                   input.jobId,
      automation_id:            input.automationId,
      lead_id:                  input.leadId,
      status:                   input.status,
      reason:                   input.reason ?? null,
      rendered_action_snapshot: input.renderedActionSnapshot ?? null,
    });
  }

  async listExecutionHistory(params: {
    automationId?: string;
    status?:       "executada" | "cancelada" | "falhou";
    pipelineId?:   string;
    page?:         number;
    pageSize?:     number;
  }): Promise<{ rows: Record<string, unknown>[]; total: number }> {
    const page     = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to   = from + pageSize - 1;
    let automationIds: string[] | null = null;

    if (params.pipelineId) {
      const { data } = await this.db.from("workflow_automations").select("id").eq("pipeline_id", params.pipelineId);
      automationIds = ((data as { id: string }[]) ?? []).map(a => a.id);
      if (automationIds.length === 0) return { rows: [], total: 0 };
    }

    let query = this.db
      .from("workflow_execution_log")
      .select("id, job_id, automation_id, lead_id, status, reason, executed_at, workflow_automations(name, pipeline_id), leads(name)", { count: "exact" })
      .order("executed_at", { ascending: false })
      .range(from, to);

    if (params.automationId) query = query.eq("automation_id", params.automationId);
    if (params.status)       query = query.eq("status", params.status);
    if (automationIds)       query = query.in("automation_id", automationIds);

    const { data, count } = await query;
    const rows = (data as Record<string, unknown>[]) ?? [];

    return { rows, total: count ?? rows.length };
  }

  async clearExecutionHistory(params: {
    automationId?: string;
    pipelineId?:   string;
  }): Promise<{ deleted: number; error: string | null }> {
    let automationIds: string[] | null = null;

    if (params.pipelineId) {
      const { data, error } = await this.db
        .from("workflow_automations")
        .select("id")
        .eq("pipeline_id", params.pipelineId);
      if (error) return { deleted: 0, error: error.message };

      automationIds = ((data as { id: string }[]) ?? []).map(a => a.id);
      if (automationIds.length === 0) return { deleted: 0, error: null };
    }

    let query = this.db
      .from("workflow_execution_log")
      .delete({ count: "exact" });

    if (params.automationId) query = query.eq("automation_id", params.automationId);
    if (automationIds)       query = query.in("automation_id", automationIds);

    const { count, error } = await query;
    return { deleted: count ?? 0, error: error?.message ?? null };
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────

  async getDashboardStats(pipelineId?: string): Promise<{
    activeAutomations: number;
    pendingJobs:       number;
    executedToday:     number;
    cancelledJobs:     number;
    failedJobs:        number;
    lastExecution:     { automationName: string; leadName: string; status: string; executedAt: string } | null;
  }> {
    let automationIds: string[] | null = null;
    if (pipelineId) {
      const { data } = await this.db.from("workflow_automations").select("id").eq("pipeline_id", pipelineId);
      automationIds = ((data as { id: string }[]) ?? []).map(a => a.id);
    }

    const [activeRes, pendingRes, executedTodayRes, cancelledRes, failedRes, lastExecRes] = await Promise.all([
      (() => {
        let q = this.db.from("workflow_automations").select("id", { count: "exact", head: true }).eq("status", "ativa");
        if (pipelineId) q = q.eq("pipeline_id", pipelineId);
        return q;
      })(),
      (() => {
        let q = this.db.from("workflow_jobs").select("id", { count: "exact", head: true }).eq("status", "pending");
        if (pipelineId) q = q.in("automation_id", automationIds ?? []);
        return q;
      })(),
      (() => {
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        let q = this.db.from("workflow_execution_log").select("id", { count: "exact", head: true })
          .eq("status", "executada").gte("executed_at", todayStart.toISOString());
        if (pipelineId) q = q.in("automation_id", automationIds ?? []);
        return q;
      })(),
      (() => {
        let q = this.db.from("workflow_execution_log").select("id", { count: "exact", head: true }).eq("status", "cancelada");
        if (pipelineId) q = q.in("automation_id", automationIds ?? []);
        return q;
      })(),
      (() => {
        let q = this.db.from("workflow_execution_log").select("id", { count: "exact", head: true }).eq("status", "falhou");
        if (pipelineId) q = q.in("automation_id", automationIds ?? []);
        return q;
      })(),
      (() => {
        let q = this.db.from("workflow_execution_log")
          .select("status, executed_at, workflow_automations(name), leads(name)")
          .order("executed_at", { ascending: false }).limit(1);
        if (pipelineId) q = q.in("automation_id", automationIds ?? []);
        return q;
      })(),
    ]);

    const lastRow = ((lastExecRes.data as Record<string, unknown>[]) ?? [])[0] ?? null;
    const lastExecution = lastRow
      ? {
          automationName: (lastRow.workflow_automations as { name?: string } | null)?.name ?? "",
          leadName:       (lastRow.leads as { name?: string } | null)?.name ?? "",
          status:         lastRow.status as string,
          executedAt:     lastRow.executed_at as string,
        }
      : null;

    return {
      activeAutomations: activeRes.count ?? 0,
      pendingJobs:       pendingRes.count ?? 0,
      executedToday:     executedTodayRes.count ?? 0,
      cancelledJobs:     cancelledRes.count ?? 0,
      failedJobs:        failedRes.count ?? 0,
      lastExecution,
    };
  }
}
