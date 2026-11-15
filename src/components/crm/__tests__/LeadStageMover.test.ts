import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CrmStage } from "@/types/crm";
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
import { LeadStageMover } from "../LeadStageMover";
const stages = [{ id: "one", name: "Novo", is_active: true }, { id: "two", name: "Qualificado", is_active: true }, { id: "three", name: "Negociação", is_active: true, require_note: true }] as CrmStage[];
let host: HTMLDivElement; let root: Root;
describe("quick stage movement", () => {
  beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
  const button = (label: string) => Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.includes(label))!;
  it("opens the internally scrolling stage list and moves immediately on selection", async () => {
    const onMove = vi.fn().mockResolvedValue({ ok: true });
    await act(async () => root.render(createElement(LeadStageMover, { stages, currentStageId: "one", onMove })));
    await act(async () => button("Mover lead").click());
    expect(Array.from(host.querySelectorAll("button")).find((item) => item.textContent === "Novo")!.disabled).toBe(true);
    expect(host.querySelector('[aria-label="Etapas da pipeline atual"]')?.className).toContain("overflow-y-auto");
    await act(async () => button("Qualificado").click());
    expect(onMove).toHaveBeenCalledWith("two", undefined);
    expect(host.querySelector('[aria-label="Etapas da pipeline atual"]')).toBeNull();
  });
  it("requires an observation before calling the movement service", async () => {
    const onMove = vi.fn().mockResolvedValue({ ok: true });
    await act(async () => root.render(createElement(LeadStageMover, { stages, currentStageId: "one", onMove })));
    await act(async () => button("Mover lead").click()); await act(async () => button("Negociação").click());
    expect(onMove).not.toHaveBeenCalled(); expect(button("Confirmar movimentação").disabled).toBe(true);
    const input = host.querySelector("textarea")!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, "Cliente interessado"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => button("Confirmar movimentação").click());
    expect(onMove).toHaveBeenCalledWith("three", "Cliente interessado");
  });
  it("shows an error and keeps the list available when movement fails", async () => {
    const onMove = vi.fn().mockResolvedValue({ ok: false, error: "Sem permissão" });
    await act(async () => root.render(createElement(LeadStageMover, { stages, currentStageId: "one", onMove })));
    await act(async () => button("Mover lead").click()); await act(async () => button("Qualificado").click());
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("Sem permissão");
    expect(host.querySelector('[aria-label="Etapas da pipeline atual"]')).not.toBeNull();
  });
});
