import { describe, expect, it } from "vitest";
import { applyLeadStageRealtimeMessage, parseLeadStageRealtimeMessage } from "@/lib/crm/lead-realtime";
import type { Lead } from "@/types";

describe("CRM lead realtime", () => {
  it("valida mensagens de movimentação antes de aplicá-las", () => {
    expect(parseLeadStageRealtimeMessage({ leadId: "lead-1", stageId: "stage-2", updatedAt: "2026-08-26T12:00:00.000Z", mutationId: "move-1" })).toEqual({
      leadId: "lead-1",
      stageId: "stage-2",
      updatedAt: "2026-08-26T12:00:00.000Z",
      mutationId: "move-1",
      rollback: false,
    });
    expect(parseLeadStageRealtimeMessage({ leadId: "lead-1", stageId: 3 })).toBeNull();
  });

  it("move somente o card informado e preserva os demais dados", () => {
    const leads = [
      { id: "lead-1", stage_id: "stage-1", updated_at: "2026-08-25T12:00:00.000Z", name: "Lead A" },
      { id: "lead-2", stage_id: "stage-1", updated_at: "2026-08-25T12:00:00.000Z", name: "Lead B" },
    ] as Lead[];
    const result = applyLeadStageRealtimeMessage(leads, {
      leadId: "lead-1",
      stageId: "stage-2",
      updatedAt: "2026-08-26T12:00:00.000Z",
      mutationId: "move-1",
    });
    expect(result[0]).toMatchObject({ id: "lead-1", stage_id: "stage-2", name: "Lead A" });
    expect(result[1]).toBe(leads[1]);
  });
});
