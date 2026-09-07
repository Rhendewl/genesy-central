import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchPushToUser } from "@/lib/notifications/push-dispatcher";
import { persistOperationalAlert } from "@/lib/notifications/operational-alert";

vi.mock("@/lib/notifications/push-dispatcher", () => ({ dispatchPushToUser: vi.fn() }));

describe("persistOperationalAlert", () => {
  beforeEach(() => vi.clearAllMocks());

  it("persists the bell notification and records an accepted mobile push", async () => {
    const inserts: Array<Record<string, unknown>> = [];
    const updates: Array<Record<string, unknown>> = [];
    const db = {
      from(table: string) {
        if (table === "user_profiles") {
          const result = Promise.resolve({ data: [{ id: "profile-1", owner_id: "owner-1", auth_user_id: "auth-1" }], error: null });
          const builder = { select: () => builder, eq: () => builder, in: () => builder, not: () => result, then: result.then.bind(result) };
          return builder;
        }
        const builder = {
          insert: (payload: Record<string, unknown>) => { inserts.push(payload); return builder; },
          select: () => builder,
          single: () => Promise.resolve({ data: { id: "notification-1" }, error: null }),
          update: (payload: Record<string, unknown>) => { updates.push(payload); return builder; },
          eq: () => Promise.resolve({ error: null }),
        };
        return builder;
      },
    };
    vi.mocked(dispatchPushToUser).mockResolvedValue({ subscriptions: 1, accepted: 1, failed: 0, removed: 0 });

    const result = await persistOperationalAlert(db as never, {
      ownerUserId: "owner-1",
      roles: ["admin"],
      eventId: "contract-1",
      source: "client_contract",
      title: "Contrato vence em 30 dias",
      body: "Cliente Exemplo",
      actionUrl: "/clientes",
    });

    expect(inserts[0]).toMatchObject({ event_id: "contract-1", recipient_user_id: "profile-1" });
    expect(dispatchPushToUser).toHaveBeenCalledWith(db, "auth-1", "Contrato vence em 30 dias", "Cliente Exemplo", expect.objectContaining({ url: "/clientes" }));
    expect(updates[0]).toMatchObject({ push_status: "accepted", push_accepted: 1, push_failed: 0 });
    expect(result).toMatchObject({ created: 1, accepted: 1, failed: 0 });
  });
});
