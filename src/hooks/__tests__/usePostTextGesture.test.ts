import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePostTextGesture } from "../usePostTextGesture";

let host: HTMLDivElement;
let root: Root;
const select = vi.fn();
const edit = vi.fn();
let enabled = true;
let selected = true;

function Fixture() {
  const gesture = usePostTextGesture(enabled, select, edit, selected);
  return createElement("div", { ...gesture, "data-box": true },
    createElement("span", { "data-text": true }, "Texto"),
    createElement("button", { "data-text-action": true, "data-text-drag-handle": true }, "Controle"),
    createElement("button", { "data-text-action": true }, "Excluir"),
    createElement("div", { contentEditable: true }, "Em edição"),
  );
}

function pointer(target: Element, type: string, pointerType = "mouse", x = 20, y = 20) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y });
  Object.defineProperties(event, { pointerId: { value: 1 }, pointerType: { value: pointerType } });
  act(() => { target.dispatchEvent(event); });
}
function tap(target: Element, pointerType = "mouse") {
  pointer(target, "pointerdown", pointerType);
  pointer(target, "pointerup", pointerType);
}

describe("post text selection and editing", () => {
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    select.mockReset(); edit.mockReset(); enabled = true; selected = true;
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    act(() => root.render(createElement(Fixture)));
  });
  afterEach(() => {
    act(() => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals();
  });

  it.each(["mouse", "touch", "pen"])("selects on one %s tap and edits on two", (type) => {
    const text = host.querySelector("[data-text]")!;
    tap(text, type);
    expect(select).toHaveBeenCalledTimes(1); expect(edit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100); tap(text, type);
    expect(edit).toHaveBeenCalledTimes(1);
  });

  it("edits through the drag control even when its bubble handlers stop propagation", () => {
    const handle = host.querySelector("[data-text-drag-handle]")!;
    handle.addEventListener("pointerdown", (event) => event.stopPropagation());
    handle.addEventListener("pointerup", (event) => event.stopPropagation());
    tap(handle); tap(handle);
    expect(edit).toHaveBeenCalledTimes(1);
  });

  it("recognizes taps retargeted to the containing box by pointer capture", () => {
    const text = host.querySelector("[data-text]")!;
    const box = host.querySelector("[data-box]")!;
    pointer(text, "pointerdown"); pointer(box, "pointerup");
    pointer(text, "pointerdown"); pointer(box, "pointerup");
    expect(edit).toHaveBeenCalledTimes(1);
  });

  it("does not edit after a drag, including a drag returning to its origin", () => {
    const text = host.querySelector("[data-text]")!;
    tap(text);
    pointer(text, "pointerdown"); pointer(text, "pointermove", "mouse", 80, 20); pointer(text, "pointerup");
    expect(edit).not.toHaveBeenCalled();
    tap(text); expect(edit).not.toHaveBeenCalled();
  });

  it("keeps distant or slow taps as separate selections", () => {
    const text = host.querySelector("[data-text]")!;
    tap(text); vi.advanceTimersByTime(400); tap(text);
    expect(edit).not.toHaveBeenCalled();
    pointer(text, "pointerdown", "mouse", 100, 100); pointer(text, "pointerup", "mouse", 100, 100);
    expect(edit).not.toHaveBeenCalled();
  });

  it("starts a new tap sequence after deselecting the text", () => {
    const text = host.querySelector("[data-text]")!;
    tap(text);
    selected = false;
    act(() => root.render(createElement(Fixture)));
    tap(text);
    expect(edit).not.toHaveBeenCalled();
    tap(text);
    expect(edit).toHaveBeenCalledTimes(1);
  });

  it("does not treat a cancelled pointer as a tap", () => {
    const text = host.querySelector("[data-text]")!;
    tap(text); pointer(text, "pointerdown"); pointer(text, "pointercancel"); tap(text);
    expect(edit).not.toHaveBeenCalled();
  });

  it("leaves other actions and text already being edited alone", () => {
    tap(host.querySelector("[data-text-action]:not([data-text-drag-handle])")!);
    tap(host.querySelector("[contenteditable]")!);
    expect(select).not.toHaveBeenCalled(); expect(edit).not.toHaveBeenCalled();
    enabled = false; act(() => root.render(createElement(Fixture)));
    tap(host.querySelector("[data-text]")!); tap(host.querySelector("[data-text]")!);
    expect(select).not.toHaveBeenCalled(); expect(edit).not.toHaveBeenCalled();
  });
});
