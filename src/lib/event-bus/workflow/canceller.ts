// Workflow Job Canceller — subscribed a todo evento de ciclo de vida do
// lead. Cancela PROATIVAMENTE jobs pendentes cujas condições já não fazem
// mais sentido, no mesmo instante da mudança de estado — em vez de deixar o
// JobExecutor descobrir isso só na hora agendada.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventConsumer, BusEvent } from "@/lib/event-bus/types";
import { ConsumerPriority } from "@/lib/event-bus/types";
import { allListenedEvents } from "@/lib/workflow-engine/trigger-registry";
import { bootstrapWorkflowEngine } from "@/lib/workflow-engine/bootstrap";
import { JobCanceller } from "@/lib/workflow-engine/job-canceller";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export function createWorkflowJobCanceller(db: Db): EventConsumer {
  bootstrapWorkflowEngine();
  const canceller = new JobCanceller(db);

  return {
    name:     "workflow-job-canceller",
    // HIGH: roda antes do workflow-trigger-consumer (NORMAL) — cancela jobs
    // obsoletos antes de eventualmente agendar novos para o mesmo lead.
    priority: ConsumerPriority.HIGH,
    events:   allListenedEvents(),

    async handle(event: BusEvent): Promise<void> {
      const leadId = (event.payload as { leadId?: string | null })?.leadId;
      if (!leadId) return;
      await canceller.recheckPendingJobsForLead(leadId);
    },
  };
}
