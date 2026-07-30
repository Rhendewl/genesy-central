import { describe, expect, it } from "vitest";
import { filterWorkspaceTasks } from "../task-filters";
import type { WorkspaceTask } from "@/types/workspace";

function task(overrides: Partial<WorkspaceTask>): WorkspaceTask {
  return {
    id: "task", user_id: "owner", created_by: "owner", board_id: "board", title: "Tarefa", description: null,
    status: "a_fazer", priority: "media", assignee_ids: [], tags: [], due_date: null,
    due_time: null, color: null, notes: null, position: 0, completed_at: null,
    created_at: "2026-07-01", updated_at: "2026-07-01", ...overrides,
  };
}

describe("filterWorkspaceTasks", () => {
  it("combina responsável e prazo sem incluir tarefas fora do intervalo", () => {
    const tasks = [
      task({ id: "match", assignee_ids: ["member"], due_date: "2026-07-24" }),
      task({ id: "late", assignee_ids: ["member"], due_date: "2026-07-29" }),
      task({ id: "other-user", assignee_ids: ["other"], due_date: "2026-07-24" }),
    ];
    expect(filterWorkspaceTasks(tasks, { due: "next_7_days", assigneeId: "member" }, new Date(2026, 6, 20)).map((item) => item.id))
      .toEqual(["match"]);
  });
});
