import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { LeadRoulettes } from "../admin/LeadRoulettes";

const data = {
  roulettes: [], forms: [{ id: "form", name: "Residencial" }], metaForms: [],
  pipelines: [
    { id: "a", name: "Ana", is_active: true, default_assignee_id: "ana", crm_stages: [{ id: "sa", name: "Novo", is_active: true, order_index: 0 }] },
    { id: "b", name: "Sem dono", is_active: true, default_assignee_id: null, crm_stages: [{ id: "sb", name: "Novo", is_active: true, order_index: 0 }] },
  ], profiles: [{ id: "ana", full_name: "Ana Maria", is_active: true, auth_user_id: "auth-ana" }], history: [], pendingCount: 0,
};
afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ""; });
it("requires an eligible pipeline and saves its selected entry stage", async () => {
  const request = vi.fn().mockResolvedValue({ ok: true, json: async () => data });
  vi.stubGlobal("fetch", request);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(LeadRoulettes)));
  const buttons = () => Array.from(container.querySelectorAll("button"));
  await act(async () => buttons().find(b => b.textContent?.includes("Nova roleta"))!.click());
  const inputs = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
  expect(inputs[0].disabled).toBe(false); expect(inputs[1].disabled).toBe(true);
  await act(async () => inputs[0].click());
  expect(container.querySelector('select[aria-label="Etapa de entrada em Ana"]')).not.toBeNull();
  await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  const posted = JSON.parse(request.mock.calls.find(call => call[1]?.method === "POST")![1].body);
  expect(posted.stage_ids).toEqual(["sa"]);
  expect(posted.enabled).toBe(true);
  await act(async () => root.unmount());
});
it("presents a load failure instead of offering an unusable creation form", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Atualize o banco" }) }));
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(LeadRoulettes)));
  expect(container.querySelector('[role="alert"]')?.textContent).toBe("Atualize o banco");
  expect(container.querySelector("button")?.disabled).toBe(true);
  await act(async () => root.unmount());
});
it("toggles directly from the card and confirms before requesting deletion", async () => {
  const card = { id: "roulette", name: "Equipe", source_kind: "genesy", form_id: "form", page_id: "", stage_ids: ["sa"], enabled: true };
  const request = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...data, roulettes: [card] }) });
  vi.stubGlobal("fetch", request); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(LeadRoulettes)));
  await act(async () => (container.querySelector('[role="switch"]') as HTMLButtonElement).click());
  expect(JSON.parse(request.mock.calls.find(call => call[1]?.method === "POST")![1].body)).toEqual({ action: "toggle", id: "roulette", enabled: false });
  request.mockClear();
  await act(async () => (container.querySelector('[aria-label="Excluir roleta Equipe"]') as HTMLButtonElement).click());
  expect(request).not.toHaveBeenCalled();
  const dialog = container.querySelector('[role="alertdialog"]')!;
  expect(dialog.textContent).toContain("histórico serão preservados");
  await act(async () => Array.from(dialog.querySelectorAll('button')).find(b => b.textContent === 'Excluir roleta')!.click());
  expect(JSON.parse(request.mock.calls.find(call => call[1]?.method === "POST")![1].body)).toEqual({ action: "delete", id: "roulette" });
  await act(async () => root.unmount());
});
