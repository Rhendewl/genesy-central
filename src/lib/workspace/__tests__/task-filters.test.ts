import { describe, expect, it } from "vitest";
import { filterWorkspaceTasks } from "../task-filters";
import type { Tag } from "@/types";
import type { WorkspaceTask } from "@/types/workspace";

const tag: Tag = { id: "tag-social", user_id: "owner", name: "Social Mídia", color: "#34d399", created_at: "2026-07-01" };

function task(overrides: Partial<WorkspaceTask>): WorkspaceTask {
  return {
    id: "task", user_id: "owner", created_by: "owner", title: "Tarefa", description: null,
    status: "a_fazer", priority: "media", assignee_ids: [], tags: [], due_date: null,
    due_time: null, color: null, notes: null, position: 0, completed_at: null,
    created_at: "2026-07-01", updated_at: "2026-07-01", ...overrides,
  };
}

describe("filterWorkspaceTasks", () => {
  it("filtra etiqueta pelo UUID atual e pelo nome salvo em tarefas legadas", () => {
    const tasks = [
      task({ id: "uuid", tags: [tag.id] }),
      task({ id: "legacy", tags: ["social midia"] }),
      task({ id: "other", tags: ["financeiro"] }),
    ];
    expect(filterWorkspaceTasks(tasks, { tagId: tag.id, due: "", assigneeId: "" }, [tag]).map((item) => item.id))
      .toEqual(["uuid", "legacy"]);
  });

  it("combina responsável e prazo sem incluir tarefas fora do intervalo", () => {
    const tasks = [
      task({ id: "match", assignee_ids: ["member"], due_date: "2026-07-24" }),
      task({ id: "late", assignee_ids: ["member"], due_date: "2026-07-29" }),
      task({ id: "other-user", assignee_ids: ["other"], due_date: "2026-07-24" }),
    ];
    expect(filterWorkspaceTasks(tasks, { tagId: "", due: "next_7_days", assigneeId: "member" }, [], new Date(2026, 6, 20)).map((item) => item.id))
      .toEqual(["match"]);
  });
});
