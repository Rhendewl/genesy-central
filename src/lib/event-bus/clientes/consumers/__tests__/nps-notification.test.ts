import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BusEvent } from "@/lib/event-bus/types";
import { persistOperationalAlert } from "@/lib/notifications/operational-alert";
import { createNpsResponseNotificationConsumer } from "../nps-notification";

vi.mock("@/lib/notifications/operational-alert", () => ({ persistOperationalAlert: vi.fn() }));

describe("NPS response notification", () => {
  beforeEach(() => vi.clearAllMocks());

  it("persists and pushes only to active administrators", async () => {
    vi.mocked(persistOperationalAlert).mockResolvedValue({ recipients: 2, created: 2, accepted: 2, failed: 0, noSubscription: 0 });
    const consumer = createNpsResponseNotificationConsumer({} as never);
    const event: BusEvent = {
      id: "event-1",
      type: "nps.response_received",
      correlationId: "correlation-1",
      source: "form",
      timestamp: Date.now(),
      meta: {},
      payload: { responseId: "nps-1", userId: "owner-1", clientId: "client-1", clientName: "Cliente Exemplo", score: 10, referenceMonth: "2026-09", comment: "Excelente" },
    };

    await consumer.handle(event);

    expect(persistOperationalAlert).toHaveBeenCalledWith({}, expect.objectContaining({
      ownerUserId: "owner-1",
      roles: ["admin"],
      eventId: "nps-response:nps-1",
      source: "nps_response",
      actionUrl: "/clientes?tab=nps&client_id=client-1",
    }));
  });
});
