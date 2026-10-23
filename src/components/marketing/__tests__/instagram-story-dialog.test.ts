import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => createElement("div", null, children),
  DialogContent: ({ children }: { children: React.ReactNode }) => createElement("div", null, children),
  DialogTitle: ({ children }: { children: React.ReactNode }) => createElement("h2", null, children),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
import { InstagramStoryDialog } from "../InstagramStoryDialog";
let root: Root; let host: HTMLDivElement;
const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });
describe("Story confirmation", () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    sessionStorage.clear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:selected-slide"), revokeObjectURL: vi.fn() }));
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
  it("previews the selected slide and does not publish before confirmation", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ accounts: [{ id: "a", username: "account", needsReconnect: false }] })); vi.stubGlobal("fetch", fetcher);
    await act(async () => root.render(createElement(InstagramStoryDialog, { image: new Blob(["image"], { type: "image/jpeg" }), slideNumber: 3, onClose: vi.fn() })));
    expect(host.querySelector("img")?.alt).toContain("3"); expect(host.textContent).toContain("@account"); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("sends the captured image to the chosen account only after confirmation", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({ accounts: [{ id: "a", username: "account", needsReconnect: false }] }))
      .mockResolvedValueOnce(json({ ticket: "container-ticket" })).mockResolvedValueOnce(json({ published: true }));
    vi.stubGlobal("fetch", fetcher); const close = vi.fn();
    await act(async () => root.render(createElement(InstagramStoryDialog, { image: new Blob(["selected-image"], { type: "image/jpeg" }), slideNumber: 2, onClose: close })));
    const publish = Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "Publicar agora")!;
    await act(async () => publish.click());
    const body = fetcher.mock.calls[1][1].body as FormData;
    expect(body.get("connectionId")).toBe("a"); expect((body.get("image") as File).type).toBe("image/jpeg");
    expect(JSON.parse(fetcher.mock.calls[2][1].body)).toEqual({ ticket: "container-ticket" }); expect(close).toHaveBeenCalledOnce(); expect(sessionStorage.getItem("genesy-pending-instagram-story")).toBeNull();
  });
});
