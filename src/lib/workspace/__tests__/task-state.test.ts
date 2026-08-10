import { describe, expect, it } from "vitest";
import type { WorkspaceTask } from "@/types/workspace";
import { shouldKeepWorkspaceTask, uniqueWorkspaceTasks, upsertWorkspaceTask } from "../task-state";

function task(id: string, title: string): WorkspaceTask {
  return {
    id,
    user_id: "owner-1",
    created_by: "owner-1",
    board_id: "board-1",
    title,
    description: null,
    status: "a_fazer",
    priority: "media",
    assignee_ids: [],
    tags: [],
    due_date: null,
    due_time: null,
    color: null,
    notes: null,
    position: 0,
    completed_at: null,
    created_at: "2026-07-24T00:00:00.000Z",
    updated_at: "2026-07-24T00:00:00.000Z",
  };
}

describe("workspace task state", () => {
  it("não duplica o retorno do POST quando o Realtime já inseriu o mesmo ID", () => {
    const realtimeTask = task("task-1", "Tarefa teste");
    const postTask = { ...realtimeTask, assignee_ids: ["profile-1"] };

    const result = upsertWorkspaceTask([realtimeTask], postTask);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(postTask);
  });

  it("insere normalmente uma tarefa ainda ausente", () => {
    const result = upsertWorkspaceTask([task("task-1", "Primeira")], task("task-2", "Segunda"));
    expect(result.map((item) => item.id)).toEqual(["task-1", "task-2"]);
  });

  it("remove IDs repetidos recebidos defensivamente em uma recarga", () => {
    const repeated = task("task-1", "Tarefa teste");
    expect(uniqueWorkspaceTasks([repeated, repeated])).toEqual([repeated]);
  });

  it("mantém concluídas por 24 horas e depois as retira da lista ativa", () => {
    const now = new Date("2026-08-10T15:00:00.000Z");

    expect(shouldKeepWorkspaceTask({ ...task("recent", "Recente"),
      status: "concluido",
      completed_at: "2026-08-09T15:00:01.000Z",
    }, now)).toBe(true);
    expect(shouldKeepWorkspaceTask({ ...task("expired", "Expirada"),
      status: "concluido",
      completed_at: "2026-08-09T15:00:00.000Z",
    }, now)).toBe(false);
    expect(shouldKeepWorkspaceTask({
      ...task("active", "Ativa"),
      status: "em_andamento",
    }, now)).toBe(true);
  });
});
