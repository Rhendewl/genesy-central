import type { SupabaseClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Engine — Core Types
//
// Domínio-agnóstico: nada aqui conhece "lead", "pipeline" ou qualquer conceito
// de CRM. Os adaptadores específicos de cada módulo (ver ./crm/) implementam
// estas interfaces e se registram nos registries — o núcleo (JobScheduler,
// JobExecutor, JobCanceller, WorkflowService) nunca importa nada de ./crm.
//
// Isso é o que permite reutilizar o mesmo motor em Agenda/Workspace/
// Formulários/Financeiro no futuro: cada módulo só precisa de um arquivo novo
// de resolvers, registrado no bootstrap — zero mudança neste arquivo ou nos
// serviços do núcleo.
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = SupabaseClient<any, any, any>;

/** Evento cru vindo do EventBus, dissociado de BusEvent<T> — o engine nunca importa event-bus/types diretamente. */
export interface WorkflowRawEvent {
  type:    string;
  payload: unknown;
  userId:  string;
}

export type DelayType =
  | "immediate"
  | "after_minutes"
  | "after_hours"
  | "after_days"
  | "tomorrow"
  | "specific_time"
  | "next_business_day";

// ── Trigger ───────────────────────────────────────────────────────────────────

export interface TriggerMatchContext {
  db:    Db;
  event: WorkflowRawEvent;
}

export interface TriggerMatchResult {
  matched:   boolean;
  /** O registro ao qual o job se prende — leadId hoje, taskId/formId em módulos futuros. */
  recordId?: string;
  /** Capturado no momento do match — vira workflow_jobs.trigger_snapshot. */
  snapshot?: Record<string, unknown>;
}

export interface TriggerResolver {
  /** Namespaced, ex: "crm.lead.stage_entered". Armazenado em workflow_automations.trigger_type. */
  type: string;
  /** Tipos de evento cru que este resolver precisa receber para ter chance de casar. */
  listensTo: string[];
  /**
   * Resolve o "escopo" (pipeline) do evento ANTES de qualquer config de
   * automação específica — é o que permite ao consumer buscar só as
   * automações candidatas (por pipeline_id + trigger_type) sem varrer todas
   * as automações da plataforma a cada evento. Necessário porque nem todo
   * payload cru carrega pipelineId diretamente (ex: eventos de tag/booking).
   */
  resolvePipelineId(ctx: TriggerMatchContext): Promise<string | null>;
  match(ctx: TriggerMatchContext, triggerConfig: Record<string, unknown>): Promise<TriggerMatchResult>;
}

// ── Condition ─────────────────────────────────────────────────────────────────

export interface ConditionEvalContext {
  db:              Db;
  recordId:        string;
  triggerSnapshot: Record<string, unknown>;
}

export interface ConditionResolver {
  /** ex: "crm.lead.same_stage" */
  type: string;
  evaluate(ctx: ConditionEvalContext, conditionConfig: Record<string, unknown>): Promise<boolean>;
}

// ── Action ────────────────────────────────────────────────────────────────────

export interface ActionExecContext {
  db:           Db;
  recordId:     string;
  automationId: string;
  jobId:        string;
  userId:       string;
  /** Variáveis {{var}} já resolvidas para este registro. */
  variables:    Record<string, string>;
}

export interface ActionExecResult {
  ok:               boolean;
  error?:           string;
  renderedSnapshot?: Record<string, unknown>;
}

export interface ActionExecutor {
  /** ex: "core.notification.create" */
  type: string;
  execute(ctx: ActionExecContext, actionConfig: Record<string, unknown>): Promise<ActionExecResult>;
}
