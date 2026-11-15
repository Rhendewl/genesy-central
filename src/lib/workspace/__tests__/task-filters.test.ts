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

it('filters by all selected workspace tags',()=>{
 const tasks=[task({id:'one',tags:['design','finance']}),task({id:'two',tags:['design']})];
 expect(filterWorkspaceTasks(tasks,{due:'',assigneeId:'',tagIds:['design','finance']}).map(t=>t.id)).toEqual(['one']);
});

it("searches titles, descriptions and notes without accents", () => {
  const source = [task({ id: "a", title: "Reunião comercial" }), task({ id: "b", notes: "Reunião com cliente" }), task({ id: "c", description: "Outro assunto" })];
  expect(filterWorkspaceTasks(source, { due: "", assigneeId: "", search: "reuniao" }).map(item => item.id)).toEqual(["a", "b"]);
});
it("filters a custom completion period inclusively in Fortaleza time", () => {
  const source = [
    task({ id: "before", status: "concluido", completed_at: "2026-10-29T02:59:59Z" }),
    task({ id: "start", status: "concluido", completed_at: "2026-10-29T03:00:00Z" }),
    task({ id: "end", status: "concluido", completed_at: "2026-10-30T02:59:59Z" }),
    task({ id: "after", status: "concluido", completed_at: "2026-10-30T03:00:00Z" }), task({ id: "pending" }),
  ];
  expect(filterWorkspaceTasks(source, { due: "", assigneeId: "", dateField: "completed_at", dateFrom: "2026-10-29", dateTo: "2026-10-29" }).map(item => item.id)).toEqual(["start", "end"]);
});
it("combines creation date, responsible and search without excluding older history by status", () => {
  const source = [task({ id: "old", title: "Relatório", assignee_ids: ["ana"], status: "concluido", created_at: "2025-01-10T12:00:00Z" }), task({ id: "new", title: "Relatório", assignee_ids: ["ana"], created_at: "2026-01-10T12:00:00Z" })];
  expect(filterWorkspaceTasks(source, { due: "", assigneeId: "ana", search: "relatorio", dateField: "created_at", dateFrom: "2025-01-01", dateTo: "2025-01-31" }).map(item => item.id)).toEqual(["old"]);
});
