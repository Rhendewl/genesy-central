import type { Db } from "./types";
import { WorkflowRepository } from "./repositories/workflow-repository";
import { getConditionResolver } from "./condition-registry";
import { WorkflowLogger } from "./workflow-logger";

export class JobCanceller {
  private readonly repo:   WorkflowRepository;
  private readonly logger: WorkflowLogger;

  constructor(private readonly db: Db) {
    this.repo   = new WorkflowRepository(db);
    this.logger = new WorkflowLogger(db);
  }

  /**
   * Chamado logo após qualquer evento de ciclo de vida do lead (mesmo que
   * originou o job ou não). Re-checa AGORA as condições de cada job ainda
   * pendente desse lead contra o estado atual — cancela na hora os que não
   * fazem mais sentido, em vez de deixar o JobExecutor descobrir isso só na
   * hora agendada (cancelamento "quase imediato", como pedido no spec).
   */
  async recheckPendingJobsForLead(leadId: string): Promise<{ cancelled: number }> {
    const jobs = await this.repo.getPendingJobsForLead(leadId);
    let cancelled = 0;

    for (const job of jobs) {
      const automation = await this.repo.getAutomation(job.automation_id);

      if (!automation || automation.status !== "ativa") {
        const reason = !automation ? "Automação não existe mais" : "Automação pausada";
        await this.cancel(job.id, job.user_id, job.automation_id, leadId, reason);
        cancelled++;
        continue;
      }

      const conditions = await this.repo.listConditions(automation.id);
      for (const condition of conditions) {
        const resolver = getConditionResolver(condition.condition_type);
        if (!resolver) continue;
        const ok = await resolver.evaluate(
          { db: this.db, recordId: leadId, triggerSnapshot: job.trigger_snapshot },
          condition.condition_config,
        );
        if (!ok) {
          await this.cancel(job.id, job.user_id, job.automation_id, leadId, `Condição não satisfeita: ${condition.condition_type}`);
          cancelled++;
          break;
        }
      }
    }

    return { cancelled };
  }

  private async cancel(jobId: string, userId: string, automationId: string, leadId: string, reason: string): Promise<void> {
    await this.repo.markJobCancelled(jobId, reason);
    await this.logger.logCancelled({ userId, jobId, automationId, leadId, reason });
  }
}
