import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BusEvent } from "@/lib/event-bus/types";
import { dispatchPushToUser } from "@/lib/notifications/push-dispatcher";
import { createTaskNotificationConsumer } from "../task-notification";

vi.mock("@/lib/notifications/push-dispatcher", () => ({
  dispatchPushToUser: vi.fn(),
}));

const pushMock = vi.mocked(dispatchPushToUser);

function makeDb(options?: { assignmentEnabled?: boolean }) {
  const inserted: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const assignmentEnabled = options?.assignmentEnabled ?? true;

  const db = {
    from(table: string) {
      if (table === "user_profiles") {
        return {
          select: () => ({
            in: async () => ({
              data: [{ id: "profile-1", auth_user_id: "recipient-auth", owner_id: "owner-auth" }],
              error: null,
            }),
          }),
        };
      }
      if (table === "workspace_task_notification_preferences") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: { notify_on_assignment: assignmentEnabled }, error: null }) }),
          }),
        };
      }
      if (table === "workflow_notifications") {
        return {
          insert: (row: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                inserted.push(row);
                return { data: { id: "notification-1" }, error: null };
              },
            }),
          }),
          update: (row: Record<string, unknown>) => ({
            eq: async () => {
              updates.push(row);
              return { error: null };
            },
          }),
        };
      }
      throw new Error(`Tabela inesperada no teste: ${table}`);
    },
  };

  return { db, inserted, updates };
}

function assignmentEvent(): BusEvent {
  return {
    id: "b7cc4817-3630-4b69-9ec6-2aafce0487b4",
    type: "task.assigned",
    correlationId: "corr-1",
    source: "test",
    timestamp: Date.now(),
    meta: {},
    payload: {
      taskId: "77e68ad9-b334-42f5-8371-198e4a808d60",
      boardId: "4a89ad89-6cb0-4141-864c-ea4248cd4262",
      taskTitle: "Preparar campanha",
      assigneeIds: ["profile-1"],
      actorUserId: "actor-auth",
      priority: "alta",
      dueDate: null,
    },
  };
}

describe("workspace task notification consumer", () => {
  beforeEach(() => {
    pushMock.mockReset();
    pushMock.mockResolvedValue({ subscriptions: 1, accepted: 1, failed: 0, removed: 0 });
  });

  it("persiste no sino e tenta push ao atribuir uma tarefa", async () => {
    const { db, inserted, updates } = makeDb();
    const consumer = createTaskNotificationConsumer(db as never);

    await consumer.handle(assignmentEvent());

    expect(inserted).toEqual([
      expect.objectContaining({
        user_id: "owner-auth",
        recipient_user_id: "profile-1",
        source: "workspace_task",
        task_id: "77e68ad9-b334-42f5-8371-198e4a808d60",
        event_id: "b7cc4817-3630-4b69-9ec6-2aafce0487b4",
        action_url: "/workspace/kanban?board=4a89ad89-6cb0-4141-864c-ea4248cd4262&task=77e68ad9-b334-42f5-8371-198e4a808d60",
      }),
    ]);
    expect(pushMock).toHaveBeenCalledWith(
      db,
      "recipient-auth",
      "Nova tarefa atribuída",
      expect.stringContaining("Preparar campanha"),
      expect.objectContaining({
        url: "/workspace/kanban?board=4a89ad89-6cb0-4141-864c-ea4248cd4262&task=77e68ad9-b334-42f5-8371-198e4a808d60",
      }),
    );
    expect(updates).toEqual([
      expect.objectContaining({ push_status: "accepted", push_subscriptions: 1, push_accepted: 1 }),
    ]);
  });

  it("respeita a preferência de atribuição desativada", async () => {
    const { db, inserted } = makeDb({ assignmentEnabled: false });
    const consumer = createTaskNotificationConsumer(db as never);

    await consumer.handle(assignmentEvent());

    expect(inserted).toHaveLength(0);
    expect(pushMock).not.toHaveBeenCalled();
  });
});
