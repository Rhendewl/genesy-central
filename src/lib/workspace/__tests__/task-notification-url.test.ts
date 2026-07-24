import { describe, expect, it } from "vitest";
import { buildWorkspaceTaskActionUrl } from "@/lib/workspace/task-notification-url";

describe("buildWorkspaceTaskActionUrl", () => {
  it("abre a tarefa diretamente no workspace informado", () => {
    expect(buildWorkspaceTaskActionUrl("task-1", "board-project"))
      .toBe("/workspace/kanban?board=board-project&task=task-1");
  });

  it("mantém compatibilidade com eventos antigos sem board_id", () => {
    expect(buildWorkspaceTaskActionUrl("task-1"))
      .toBe("/workspace/kanban?task=task-1");
  });
});
