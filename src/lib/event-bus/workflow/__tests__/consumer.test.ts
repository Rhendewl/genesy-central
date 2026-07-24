import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BusEvent } from "@/lib/event-bus/types";
import { createWorkflowTriggerConsumer } from "../consumer";

const listActive = vi.fn();
const scheduleJob = vi.fn();
const runDueJobById = vi.fn();
const match = vi.fn();
const resolvePipelineId = vi.fn();

vi.mock("@/lib/workflow-engine/bootstrap", () => ({
  bootstrapWorkflowEngine: vi.fn(),
}));

vi.mock("@/lib/workflow-engine/trigger-registry", () => ({
  allListenedEvents: () => ["lead.stage.entered"],
  listTriggerResolvers: () => [{
    type: "crm.lead.stage_entered",
    listensTo: ["lead.stage.entered"],
    resolvePipelineId,
    match,
  }],
}));

vi.mock("@/lib/workflow-engine/repositories/workflow-repository", () => ({
  WorkflowRepository: class {
    listActiveByPipelineAndTrigger = listActive;
  },
}));

vi.mock("@/lib/workflow-engine/job-scheduler", () => ({
  JobScheduler: class {
    scheduleJob = scheduleJob;
  },
}));

vi.mock("@/lib/workflow-engine/job-executor", () => ({
  JobExecutor: class {
    runDueJobById = runDueJobById;
  },
}));

function event(): BusEvent {
  return {
    id: "event-1",
    type: "lead.stage.entered",
    correlationId: "corr-1",
    source: "test",
    timestamp: Date.now(),
    meta: {},
    payload: {
      leadId: "lead-1",
      pipelineId: "pipeline-1",
      stageId: "stage-1",
      userId: "owner-1",
    },
  };
}

describe("workflow trigger consumer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolvePipelineId.mockResolvedValue("pipeline-1");
    match.mockResolvedValue({ matched: true, recordId: "lead-1", snapshot: { stageId: "stage-1" } });
    scheduleJob.mockResolvedValue({ ok: true, jobId: "job-1", error: null });
    runDueJobById.mockResolvedValue("executed");
  });

  it("executa a automação imediata no mesmo evento", async () => {
    listActive.mockResolvedValue([{
      id: "automation-1",
      user_id: "owner-1",
      delay_type: "immediate",
      delay_config: {},
      trigger_config: { stageId: "stage-1" },
    }]);

    await createWorkflowTriggerConsumer({} as never).handle(event());

    expect(scheduleJob).toHaveBeenCalledWith(expect.objectContaining({
      automationId: "automation-1",
      leadId: "lead-1",
      delayType: "immediate",
    }));
    expect(runDueJobById).toHaveBeenCalledWith("job-1");
  });

  it("mantém automações com atraso na fila para o cron", async () => {
    listActive.mockResolvedValue([{
      id: "automation-2",
      user_id: "owner-1",
      delay_type: "after_minutes",
      delay_config: { minutes: 10 },
      trigger_config: { stageId: "stage-1" },
    }]);

    await createWorkflowTriggerConsumer({} as never).handle(event());

    expect(scheduleJob).toHaveBeenCalledOnce();
    expect(runDueJobById).not.toHaveBeenCalled();
  });
});
