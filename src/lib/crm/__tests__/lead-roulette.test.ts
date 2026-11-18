// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
const { publish } = vi.hoisted(() => ({ publish: vi.fn() }));
vi.mock("@/lib/event-bus/platform", () => ({ getPlatformEventBus: () => ({ publish }) }));
import { distributeFormLead } from "../lead-roulette";
const input = { ownerId: "owner", source: "genesy" as const, formId: "form", eventId: "submission", payload: { name: "Contato" } };
describe("lead roulette ingestion", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("publishes the committed destination instead of the fixed form destination", async () => {
    const result = { matched: true, status: "distributed", lead_id: "lead", pipeline_id: "pipeline-B", stage_id: "stage-B" };
    const rpc = vi.fn().mockResolvedValue({ data: result });
    expect(await distributeFormLead({ rpc } as unknown as SupabaseClient, input)).toEqual(result);
    expect(rpc).toHaveBeenCalledWith("crm_distribute_form_lead", expect.objectContaining({ p_owner: "owner", p_event: "submission", p_page: "" }));
    expect(publish).toHaveBeenCalledWith("lead.stage.entered", expect.objectContaining({ pipelineId: "pipeline-B", stageId: "stage-B" }));
  });
  it.each(["duplicate", "pending"])("does not publish another event for %s", async status => {
    await distributeFormLead({ rpc: vi.fn().mockResolvedValue({ data: { matched: true, status } }) } as unknown as SupabaseClient, input);
    expect(publish).not.toHaveBeenCalled();
  });
  it("does not allow a routing error to fall through to the fixed pipeline", async () => {
    await expect(distributeFormLead({ rpc: vi.fn().mockResolvedValue({ error: { message: "routing failed" } }) } as unknown as SupabaseClient, input)).rejects.toThrow("routing failed");
    expect(publish).not.toHaveBeenCalled();
  });
});
