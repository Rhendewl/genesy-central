// Workflow Trigger Consumer — subscribed a todo evento que algum
// TriggerResolver registrado escuta. Não executa nada diretamente: acha as
// automações candidatas e AGENDA um job (Cria Job, conforme o pedido) —
// quem executa de fato é o JobExecutor, chamado pelo cron.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventConsumer, BusEvent } from "@/lib/event-bus/types";
import { ConsumerPriority } from "@/lib/event-bus/types";
import { bootstrapWorkflowEngine } from "@/lib/workflow-engine/bootstrap";
import { listTriggerResolvers, allListenedEvents } from "@/lib/workflow-engine/trigger-registry";
import { WorkflowRepository } from "@/lib/workflow-engine/repositories/workflow-repository";
import { JobScheduler } from "@/lib/workflow-engine/job-scheduler";
import { JobExecutor } from "@/lib/workflow-engine/job-executor";
import type { WorkflowRawEvent } from "@/lib/workflow-engine/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export function createWorkflowTriggerConsumer(db: Db): EventConsumer {
  bootstrapWorkflowEngine();
  const repo      = new WorkflowRepository(db);
  const scheduler = new JobScheduler(db);
  const executor  = new JobExecutor(db);

  return {
    name:     "workflow-trigger-consumer",
    priority: ConsumerPriority.NORMAL,
    events:   allListenedEvents(),

    async handle(event: BusEvent): Promise<void> {
      const rawEvent: WorkflowRawEvent = { type: event.type, payload: event.payload, userId: (event.payload as { userId?: string })?.userId ?? "" };
      const ctx = { db, event: rawEvent };

      for (const resolver of listTriggerResolvers()) {
        if (!resolver.listensTo.includes(event.type)) continue;

        const pipelineId = await resolver.resolvePipelineId(ctx);
        if (!pipelineId) continue;

        const candidates = await repo.listActiveByPipelineAndTrigger(pipelineId, resolver.type);
        if (candidates.length === 0) continue;

        for (const automation of candidates) {
          const result = await resolver.match(ctx, automation.trigger_config);
          if (!result.matched || !result.recordId) continue;

          const scheduled = await scheduler.scheduleJob({
            automationId: automation.id,
            leadId:       result.recordId,
            userId:       automation.user_id,
            delayType:    automation.delay_type,
            delayConfig:  automation.delay_config,
            snapshot:     result.snapshot ?? {},
          });

          if (!scheduled.ok) {
            throw new Error(scheduled.error ?? "Não foi possível agendar a automação");
          }

          // Uma ação configurada como imediata precisa ser imediata de fato.
          // Além de reduzir latência, isso impede que notificações simples
          // parem de funcionar quando o scheduler externo estiver indisponível.
          if (automation.delay_type === "immediate" && scheduled.jobId) {
            await executor.runDueJobById(scheduled.jobId);
          }
        }
      }
    },
  };
}
