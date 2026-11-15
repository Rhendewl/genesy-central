import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { WorkspaceTask } from "@/types/workspace";
const fixtures = vi.hoisted(() => ({
  canManage: true,
  tasks: [
    { id: "a", title: "Preparar campanha", assignee_ids: ["ana"], status: "a_fazer", due_date: null },
    { id: "b", title: "Revisar site", assignee_ids: [], status: "em_andamento", due_date: "2026-12-01" },
    { id: "c", title: "Entrega anterior", assignee_ids: [], status: "concluido", completed_at: "2020-01-01T12:00:00Z", due_date: null },
  ].map(task => ({ tags: [], created_at: "2026-11-13T12:00:00Z", ...task })),
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), usePathname: () => "/workspace/kanban" }));
vi.mock("@/context/WorkspaceViewingContext", () => ({ useWorkspaceViewing: () => ({ viewingMember: null }) }));
vi.mock("@/hooks/useTags", () => ({ useTags: () => ({ tags: [] }) }));
vi.mock("@/hooks/useUsers", () => ({ useUsers: () => ({ profiles: [{ id: "ana", full_name: "Ana", is_active: true }] }) }));
vi.mock("@/hooks/useWorkspaceTasks", () => ({ useWorkspaceTasks: () => ({ tasks: fixtures.tasks, isLoading: false }) }));
vi.mock("@/hooks/useWorkspaceTaskBoards", () => ({ useWorkspaceTaskBoards: () => ({
  canManage: fixtures.canManage, isLoading: false,
  boards: [{ id: "general", name: "Geral", is_default: true, color: "#4a8fd4" }, { id: "launch", name: "Lançamento", color: "#e0a344" }],
}) }));
vi.mock("../TaskBoard", () => ({ TaskBoard: ({ visibleTasks, hiddenTasks }: { visibleTasks: WorkspaceTask[]; hiddenTasks?: WorkspaceTask[] }) => createElement("div", { "data-testid": "board" }, [...visibleTasks, ...(hiddenTasks ?? [])].map(task => task.title).join(";")) }));
vi.mock("../TaskListView", () => ({ TaskListView: ({ visibleTasks }: { visibleTasks: WorkspaceTask[] }) => createElement("div", { "data-testid": "list" }, visibleTasks.map(task => task.title).join(";")) }));
vi.mock("../TaskDetailPanel", () => ({ TaskDetailPanel: () => createElement("div", { "data-testid": "create-task" }, "Nova tarefa") }));
import WorkspaceKanbanPage from "@/app/workspace/kanban/page";
import { WorkspaceMobileControls } from "../WorkspaceMobileControls";
import { WorkspaceSubNav } from "../WorkspaceSubNav";
let host: HTMLDivElement, root: Root;
const button = (label: string) => host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
async function click(label: string) { await act(async () => button(label).click()); }
async function change(selector: string, value: string) {
  const input = host.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
  await act(async () => {
    const proto = input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  Element.prototype.scrollIntoView = vi.fn();
  localStorage.clear(); fixtures.canManage = true;
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
it("preserves search, filters and list selection when mobile controls close", async () => {
  await act(async () => root.render(createElement(WorkspaceKanbanPage)));
  expect(host.querySelector('#workspace-task-options')?.classList.contains('is-open')).toBe(false);
  await click("Buscar tarefas");
  expect(document.activeElement).toBe(host.querySelector('[aria-label="Pesquisar tarefas"]'));
  await change('[aria-label="Pesquisar tarefas"]', "campanha");
  await click("Filtros e opções das tarefas"); await click("Lista");
  await change('[aria-label="Filtrar por responsável"]', "ana");
  await click("Ocultar filtros e opções"); await click("Ocultar busca de tarefas");
  expect(host.querySelector('[data-testid="list"]')?.textContent).toBe("Preparar campanha");
  await click("Filtros e opções das tarefas"); await click("Buscar tarefas");
  expect(button("Lista").getAttribute("aria-pressed")).toBe("true");
  expect(host.querySelector<HTMLSelectElement>('[aria-label="Filtrar por responsável"]')?.value).toBe("ana");
  expect(host.querySelector<HTMLInputElement>('[aria-label="Pesquisar tarefas"]')?.value).toBe("campanha");
  await click("Nova tarefa"); expect(host.querySelector('[data-testid="create-task"]')).not.toBeNull();
});
it("changes the workspace through the mobile selector and respects management permissions", async () => {
  fixtures.canManage = false;
  await act(async () => root.render(createElement(WorkspaceKanbanPage)));
  await change('[aria-label="Workspace de tarefas"]', "launch");
  expect(localStorage.getItem("workspace-active-task-board")).toBe("launch");
  await click("Filtros e opções das tarefas");
  expect(button("Editar workspace")).toBeNull(); expect(button("Novo workspace")).toBeNull();
});
it("retains access to hidden task history from the options panel", async () => {
  await act(async () => root.render(createElement(WorkspaceKanbanPage)));
  expect(host.querySelector('[data-testid="board"]')?.textContent).not.toContain("Entrega anterior");
  await click("Filtros e opções das tarefas");
  await act(async () => host.querySelector<HTMLButtonElement>('.workspace-task-history')!.click());
  await click("Ocultar filtros e opções");
  expect(host.querySelector('[data-testid="board"]')?.textContent).toContain("Entrega anterior");
});
it("keeps objective and onboarding controls mounted when collapsed", async () => {
  const onCreate = vi.fn();
  await act(async () => root.render(createElement(WorkspaceMobileControls, { title: "Objetivos", createLabel: "Novo objetivo", onCreate }, createElement("input", { defaultValue: "Planejamento" }))));
  const input = host.querySelector("input")!;
  await click("Filtros e opções: Objetivos"); await change("input", "Meu filtro"); await click("Filtros e opções: Objetivos");
  expect(host.querySelector("input")).toBe(input); expect(input.value).toBe("Meu filtro");
  await click("Novo objetivo"); expect(onCreate).toHaveBeenCalledOnce();
});
it("retains horizontal submodule links with an active section", async () => {
  await act(async () => root.render(createElement(WorkspaceSubNav)));
  expect(host.querySelector('nav[aria-label="Navegação do Workspace"]')).not.toBeNull();
  expect(host.querySelectorAll("nav a")).toHaveLength(5);
  expect(host.querySelector('[aria-current="page"]')?.textContent).toBe("Tarefas");
  expect(host.querySelector("select")).toBeNull();
});
