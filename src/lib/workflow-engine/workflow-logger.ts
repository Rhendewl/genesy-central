import type { Db } from "./types";
import { WorkflowRepository } from "./repositories/workflow-repository";

export class WorkflowLogger {
  private readonly repo: WorkflowRepository;

  constructor(db: Db) {
    this.repo = new WorkflowRepository(db);
  }

  async logExecuted(params: {
    userId: string; jobId: string; automationId: string; leadId: string;
    renderedSnapshot: Record<string, unknown>;
  }): Promise<void> {
    await this.repo.logExecution({
      userId: params.userId, jobId: params.jobId, automationId: params.automationId,
      leadId: params.leadId, status: "executada", renderedActionSnapshot: params.renderedSnapshot,
    });
  }

  async logCancelled(params: {
    userId: string; jobId: string; automationId: string; leadId: string; reason: string;
  }): Promise<void> {
    await this.repo.logExecution({
      userId: params.userId, jobId: params.jobId, automationId: params.automationId,
      leadId: params.leadId, status: "cancelada", reason: params.reason,
    });
  }

  async logFailed(params: {
    userId: string; jobId: string; automationId: string; leadId: string; reason: string;
  }): Promise<void> {
    await this.repo.logExecution({
      userId: params.userId, jobId: params.jobId, automationId: params.automationId,
      leadId: params.leadId, status: "falhou", reason: params.reason,
    });
  }
}
