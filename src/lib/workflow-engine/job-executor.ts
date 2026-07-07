import type { Db } from "./types";
import { WorkflowRepository, type JobRow } from "./repositories/workflow-repository";
import { getConditionResolver } from "./condition-registry";
import { getActionExecutor } from "./action-registry";
import { resolveWorkflowVariables } from "./variables";
import { WorkflowLogger } from "./workflow-logger";
import { bootstrapWorkflowEngine } from "./bootstrap";

export interface RunDueJobsResult {
  processed: number;
  executed:  number;
  cancelled: number;
  failed:    number;
}

export class JobExecutor {
  private readonly repo:   WorkflowRepository;
  private readonly logger: WorkflowLogger;

  /** db deve ser um client admin (service-role) — roda os jobs de todos os usuários numa mesma passada. */
  constructor(private readonly db: Db) {
    bootstrapWorkflowEngine();
    this.repo   = new WorkflowRepository(db);
    this.logger = new WorkflowLogger(db);
  }

  async runDueJobs(limit = 200): Promise<RunDueJobsResult> {
    const jobs = await this.repo.claimDueJobs(limit);
    const result: RunDueJobsResult = { processed: 0, executed: 0, cancelled: 0, failed: 0 };

    for (const job of jobs) {
      result.processed++;
      const outcome = await this.runOne(job);
      result[outcome]++;
    }

    return result;
  }

  private async runOne(job: JobRow): Promise<"executed" | "cancelled" | "failed"> {
    const automation = await this.repo.getAutomation(job.automation_id);

    if (!automation || automation.status !== "ativa") {
      const reason = !automation ? "Automação não existe mais" : "Automação pausada";
      await this.repo.markJobCancelled(job.id, reason);
      await this.logger.logCancelled({
        userId: job.user_id, jobId: job.id, automationId: job.automation_id,
        leadId: job.lead_id, reason,
      });
      return "cancelled";
    }

    // Re-checagem defensiva das condições — JobCanceller já deveria ter
    // cancelado proativamente, mas isso cobre qualquer janela de corrida.
    const conditions = await this.repo.listConditions(automation.id);
    for (const condition of conditions) {
      const resolver = getConditionResolver(condition.condition_type);
      if (!resolver) continue; // tipo desconhecido — não bloqueia, só ignora
      const ok = await resolver.evaluate(
        { db: this.db, recordId: job.lead_id, triggerSnapshot: job.trigger_snapshot },
        condition.condition_config,
      );
      if (!ok) {
        const reason = `Condição não satisfeita: ${condition.condition_type}`;
        await this.repo.markJobCancelled(job.id, reason);
        await this.logger.logCancelled({
          userId: job.user_id, jobId: job.id, automationId: job.automation_id,
          leadId: job.lead_id, reason,
        });
        return "cancelled";
      }
    }

    const actions = await this.repo.listActions(automation.id);
    const variables = await resolveWorkflowVariables(this.db, { leadId: job.lead_id });
    const renderedSnapshots: Record<string, unknown>[] = [];

    for (const action of actions) {
      const executor = getActionExecutor(action.action_type);
      if (!executor) continue;

      const execResult = await executor.execute(
        {
          db: this.db, recordId: job.lead_id, automationId: automation.id,
          jobId: job.id, userId: job.user_id, variables,
        },
        action.action_config,
      );

      if (!execResult.ok) {
        const attempts = job.attempts + 1;
        await this.repo.markJobFailed(job.id, execResult.error ?? "Erro desconhecido", attempts, job.max_attempts);
        await this.logger.logFailed({
          userId: job.user_id, jobId: job.id, automationId: job.automation_id,
          leadId: job.lead_id, reason: execResult.error ?? "Erro desconhecido",
        });
        return "failed";
      }

      if (execResult.renderedSnapshot) renderedSnapshots.push(execResult.renderedSnapshot);
    }

    await this.repo.markJobExecuted(job.id);
    await this.logger.logExecuted({
      userId: job.user_id, jobId: job.id, automationId: job.automation_id,
      leadId: job.lead_id, renderedSnapshot: { actions: renderedSnapshots },
    });
    return "executed";
  }
}
