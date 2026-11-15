import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CrmPipeline } from "@/types/crm";
vi.mock("@/hooks/useUsers", () => ({ useUsers: () => ({ isLoading: false, profiles: [{ id: "ana", full_name: "Ana Maria", is_active: true, auth_user_id: "auth-ana" }] }) }));
import { PipelineFormModal } from "../admin/PipelineFormModal";
let root: Root; let host: HTMLDivElement;
describe("pipeline default responsible setting", () => {
  beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
  it("loads and saves the responsible of an existing pipeline", async () => {
    const save = vi.fn(async () => true); const close = vi.fn();
    await act(async () => root.render(createElement(PipelineFormModal, { open: true, pipeline: { name: "Ana Maria", default_assignee_id: "ana", color: "#123456" } as CrmPipeline, onSave: save, onClose: close })));
    expect((document.querySelector("select") as HTMLSelectElement).value).toBe("ana");
    await act(async () => document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: "Ana Maria", default_assignee_id: "ana" })); expect(close).toHaveBeenCalledOnce();
  });
  it("allows removing automatic assignment without changing existing lead ownership", async () => {
    const save = vi.fn(async () => true);
    await act(async () => root.render(createElement(PipelineFormModal, { open: true, pipeline: { name: "Pipeline", default_assignee_id: "ana" } as CrmPipeline, onSave: save, onClose: vi.fn() })));
    const input = document.querySelector("select")!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value")!.set!.call(input, ""); input.dispatchEvent(new Event("change", { bubbles: true })); });
    await act(async () => document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ default_assignee_id: null }));
  });
});
