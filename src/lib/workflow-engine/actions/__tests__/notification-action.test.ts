import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchPushToUser } from "@/lib/notifications/push-dispatcher";
import { notificationAction } from "../notification-action";

vi.mock("@/lib/notifications/push-dispatcher", () => ({
  dispatchPushToUser: vi.fn(),
  renderTemplate: (template: string, vars: Record<string, string>) => template.replace(/\{\{([^}]+)\}\}/g, (_, key) => vars[key.trim()] ?? `{{${key.trim()}}}`),
}));

const pushMock = vi.mocked(dispatchPushToUser);

function makeDb() {
  const inserted: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const db = {
    from(table: string) {
      if (table === "leads") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { assigned_to: "profile-1" } }) }) }) };
      if (table === "user_profiles") {
        return { select: () => ({ in: async () => ({ data: [{ id: "profile-1", auth_user_id: "auth-1" }], error: null }) }) };
      }
      if (table === "workflow_notifications") {
        return {
          insert: (rows: Record<string, unknown>[]) => ({
            select: async () => {
              inserted.push(...rows);
              return { data: [{ id: "notification-1", recipient_user_id: "profile-1" }], error: null };
            },
          }),
          update: (row: Record<string, unknown>) => ({ eq: async () => { updates.push(row); return { error: null }; } }),
        };
      }
      throw new Error(`Tabela inesperada: ${table}`);
    },
  };
  return { db, inserted, updates };
}

describe("notificationAction", () => {
  beforeEach(() => {
    pushMock.mockReset();
    pushMock.mockResolvedValue({ subscriptions: 1, accepted: 1, failed: 0, removed: 0 });
  });

  it("entrega o push e registra o resultado por notificação", async () => {
    const { db, inserted, updates } = makeDb();
    const result = await notificationAction.execute({
      db: db as never,
      recordId: "lead-1",
      automationId: "automation-1",
      jobId: "job-1",
      userId: "owner-1",
      variables: { nome: "Ana" },
    }, { recipientType: "lead_owner", title: "Novo contato", body: "Fale com {{nome}}" });

    expect(result.ok).toBe(true);
    expect(inserted[0]).toMatchObject({ source: "workflow", action_url: "/crm", recipient_user_id: "profile-1" });
    expect(pushMock).toHaveBeenCalledWith(db, "auth-1", "Novo contato", "Fale com Ana", expect.objectContaining({ url: "/crm" }));
    expect(updates[0]).toMatchObject({ push_status: "accepted", push_subscriptions: 1, push_accepted: 1 });
  });

  it("registra quando o destinatário ainda não ativou notificações", async () => {
    pushMock.mockResolvedValue({ subscriptions: 0, accepted: 0, failed: 0, removed: 0, skippedReason: "no_subscriptions" });
    const { db, updates } = makeDb();
    await notificationAction.execute({
      db: db as never, recordId: "lead-1", automationId: "automation-1", jobId: "job-1", userId: "owner-1", variables: {},
    }, { recipientType: "lead_owner", title: "Aviso", body: "Corpo" });

    expect(updates[0]).toMatchObject({ push_status: "no_subscription", push_subscriptions: 0 });
  });
});
