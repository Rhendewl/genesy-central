import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act, Simulate } from "react-dom/test-utils";
import { CreateEventModal } from "../CreateEventModal";
vi.mock("@/hooks/useModalOpen", () => ({ useModalOpen: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => children,
  DialogContent: ({ children }: { children: React.ReactNode }) => React.createElement("div", {}, children),
  DialogTitle: ({ children }: { children: React.ReactNode }) => React.createElement("h2", {}, children),
  DialogDescription: ({ children }: { children: React.ReactNode }) => React.createElement("p", {}, children),
}));
let host: HTMLDivElement;
let root: Root;
const onCreated = vi.fn();
const onClose = vi.fn();
const fetchMock = vi.fn();
async function change(element: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => { Simulate.change(element, { target: { value } as HTMLInputElement }); });
}
async function click(label: string) {
  const button = Array.from(host.querySelectorAll("button")).find((b) => b.textContent?.includes(label));
  expect(button).toBeTruthy();
  await act(async () => { Simulate.click(button!); });
}
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ event: { id: "saved" } }) });
  vi.stubGlobal("fetch", fetchMock);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root.render(React.createElement(CreateEventModal, { day: new Date(2026, 9, 27), onCreated, onClose })); });
  await change(host.querySelector("input")!, "Visita ao imóvel");
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
describe("new calendar event form", () => {
  it("converts days and hours to Google reminders and preserves the selected date", async () => {
    await change(host.querySelector('select[aria-label="Unidade do lembrete 1"]')!, "days");
    await change(host.querySelector('input[aria-label="Antecedência do lembrete 1"]')!, "2");
    await click("Adicionar lembrete");
    await change(host.querySelector('select[aria-label="Unidade do lembrete 2"]')!, "hours");
    await change(host.querySelector('input[aria-label="Antecedência do lembrete 2"]')!, "3");
    await act(async () => { Simulate.submit(host.querySelector("form")!); });
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.reminders).toEqual([{ method: "popup", minutes: 2880 }, { method: "popup", minutes: 180 }]);
    const date = new Date(payload.start);
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 9, 27, 9]);
    expect(onCreated).toHaveBeenCalledOnce();
  });
  it("keeps entered data on a connection error and offers reconnection", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Reconecte sua conta", reconnect: true }) });
    await act(async () => { Simulate.submit(host.querySelector("form")!); });
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("Reconecte sua conta");
    expect(host.querySelector("input")?.value).toBe("Visita ao imóvel");
    expect(host.querySelector("a")?.getAttribute("href")).toBe("/api/google-calendar/connect");
    expect(onCreated).not.toHaveBeenCalled();
  });
  it("prevents duplicate submissions while Google is saving", async () => {
    let resolve!: (value: unknown) => void;
    fetchMock.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    await act(async () => { Simulate.submit(host.querySelector("form")!); Simulate.submit(host.querySelector("form")!); });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(host.querySelector("fieldset")?.disabled).toBe(true);
    await act(async () => { resolve({ ok: true, json: async () => ({ event: { id: "saved" } }) }); });
    expect(onCreated).toHaveBeenCalledOnce();
  });
  it("supports no reminders and cancelling without creating", async () => {
    const remove = host.querySelector('button[aria-label="Remover lembrete 1"]')!;
    await act(async () => { Simulate.click(remove); });
    await act(async () => { Simulate.submit(host.querySelector("form")!); });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).reminders).toEqual([]);
    fetchMock.mockClear();
    await click("Cancelar");
    expect(onClose).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
