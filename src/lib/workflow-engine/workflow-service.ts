import type { Db, DelayType } from "./types";
import { WorkflowRepository } from "./repositories/workflow-repository";
import { getTriggerResolver } from "./trigger-registry";
import { getConditionResolver } from "./condition-registry";
import { getActionExecutor } from "./action-registry";
import { bootstrapWorkflowEngine } from "./bootstrap";

export interface AutomationConditionInput { type: string; config: Record<string, unknown>; }
export interface AutomationActionInput    { type: string; config: Record<string, unknown>; }

export interface CreateAutomationInput {
  pipelineId:    string;
  name:          string;
  status?:       "ativa" | "pausada";
  triggerType:   string;
  triggerConfig: Record<string, unknown>;
  delayType:     DelayType;
  delayConfig:   Record<string, unknown>;
  conditions:    AutomationConditionInput[];
  actions:       AutomationActionInput[];
}

export type UpdateAutomationInput = Partial<Omit<CreateAutomationInput, "conditions" | "actions" | "pipelineId">>;

export interface AutomationWithDetails {
  id:            string;
  pipelineId:    string;
  name:          string;
  status:        "ativa" | "pausada";
  triggerType:   string;
  triggerConfig: Record<string, unknown>;
  delayType:     DelayType;
  delayConfig:   Record<string, unknown>;
  conditions:    { id: string; type: string; config: Record<string, unknown>; orderIndex: number }[];
  actions:       { id: string; type: string; config: Record<string, unknown>; orderIndex: number }[];
  createdAt:     string;
  updatedAt:     string;
}

export interface WorkflowDashboardStats {
  activeAutomations: number;
  pendingJobs:       number;
  executedToday:     number;
  cancelledJobs:     number;
  failedJobs:        number;
  lastExecution:     { automationName: string; leadName: string; status: string; executedAt: string } | null;
}

function toDetails(
  automation: { id: string; pipeline_id: string; name: string; status: "ativa" | "pausada"; trigger_type: string; trigger_config: Record<string, unknown>; delay_type: DelayType; delay_config: Record<string, unknown>; created_at: string; updated_at: string },
  conditions: { id: string; condition_type: string; condition_config: Record<string, unknown>; order_index: number }[],
  actions:    { id: string; action_type: string; action_config: Record<string, unknown>; order_index: number }[],
): AutomationWithDetails {
  return {
    id:            automation.id,
    pipelineId:    automation.pipeline_id,
    name:          automation.name,
    status:        automation.status,
    triggerType:   automation.trigger_type,
    triggerConfig: automation.trigger_config,
    delayType:     automation.delay_type,
    delayConfig:   automation.delay_config,
    conditions:    conditions.map(c => ({ id: c.id, type: c.condition_type, config: c.condition_config, orderIndex: c.order_index })),
    actions:       actions.map(a => ({ id: a.id, type: a.action_type, config: a.action_config, orderIndex: a.order_index })),
    createdAt:     automation.created_at,
    updatedAt:     automation.updated_at,
  };
}

export class WorkflowService {
  private readonly repo: WorkflowRepository;

  constructor(db: Db) {
    bootstrapWorkflowEngine();
    this.repo = new WorkflowRepository(db);
  }

  async listByPipeline(pipelineId: string): Promise<AutomationWithDetails[]> {
    const automations = await this.repo.listAutomationsByPipeline(pipelineId);
    return Promise.all(automations.map(async a => {
      const [conditions, actions] = await Promise.all([
        this.repo.listConditions(a.id),
        this.repo.listActions(a.id),
      ]);
      return toDetails(a, conditions, actions);
    }));
  }

  async getById(id: string): Promise<AutomationWithDetails | null> {
    const automation = await this.repo.getAutomation(id);
    if (!automation) return null;
    const [conditions, actions] = await Promise.all([
      this.repo.listConditions(id),
      this.repo.listActions(id),
    ]);
    return toDetails(automation, conditions, actions);
  }

  private validateTypes(input: { triggerType: string; conditions: AutomationConditionInput[]; actions: AutomationActionInput[] }): string | null {
    if (!getTriggerResolver(input.triggerType)) return `Tipo de gatilho desconhecido: ${input.triggerType}`;
    for (const c of input.conditions) {
      if (!getConditionResolver(c.type)) return `Tipo de condição desconhecido: ${c.type}`;
    }
    for (const a of input.actions) {
      if (!getActionExecutor(a.type)) return `Tipo de ação desconhecido: ${a.type}`;
    }
    if (input.actions.length === 0) return "A automação precisa de ao menos uma ação";
    return null;
  }

  async create(input: CreateAutomationInput): Promise<{ ok: boolean; id: string | null; error: string | null }> {
    const validationError = this.validateTypes(input);
    if (validationError) return { ok: false, id: null, error: validationError };

    const { id, error } = await this.repo.createAutomation({
      pipelineId:    input.pipelineId,
      name:          input.name,
      status:        input.status ?? "ativa",
      triggerType:   input.triggerType,
      triggerConfig: input.triggerConfig,
      delayType:     input.delayType,
      delayConfig:   input.delayConfig,
    });
    if (error || !id) return { ok: false, id: null, error };

    const [condRes, actRes] = await Promise.all([
      this.repo.replaceConditions(id, input.conditions),
      this.repo.replaceActions(id, input.actions),
    ]);
    if (condRes.error) return { ok: false, id, error: condRes.error };
    if (actRes.error)  return { ok: false, id, error: actRes.error };

    return { ok: true, id, error: null };
  }

  async update(id: string, input: UpdateAutomationInput): Promise<{ ok: boolean; error: string | null }> {
    if (input.triggerType && !getTriggerResolver(input.triggerType)) {
      return { ok: false, error: `Tipo de gatilho desconhecido: ${input.triggerType}` };
    }
    const { error } = await this.repo.updateAutomation(id, input);
    return { ok: !error, error: error ?? null };
  }

  async replaceConditions(id: string, conditions: AutomationConditionInput[]): Promise<{ ok: boolean; error: string | null }> {
    for (const c of conditions) {
      if (!getConditionResolver(c.type)) return { ok: false, error: `Tipo de condição desconhecido: ${c.type}` };
    }
    const { error } = await this.repo.replaceConditions(id, conditions);
    return { ok: !error, error: error ?? null };
  }

  async replaceActions(id: string, actions: AutomationActionInput[]): Promise<{ ok: boolean; error: string | null }> {
    if (actions.length === 0) return { ok: false, error: "A automação precisa de ao menos uma ação" };
    for (const a of actions) {
      if (!getActionExecutor(a.type)) return { ok: false, error: `Tipo de ação desconhecido: ${a.type}` };
    }
    const { error } = await this.repo.replaceActions(id, actions);
    return { ok: !error, error: error ?? null };
  }

  async delete(id: string): Promise<{ ok: boolean; error: string | null }> {
    const { error } = await this.repo.deleteAutomation(id);
    return { ok: !error, error: error ?? null };
  }

  async getDashboardStats(pipelineId?: string): Promise<WorkflowDashboardStats> {
    return this.repo.getDashboardStats(pipelineId);
  }

  async getHistory(params: { automationId?: string; status?: "executada" | "cancelada" | "falhou"; pipelineId?: string; page?: number; pageSize?: number }) {
    return this.repo.listExecutionHistory(params);
  }
}
