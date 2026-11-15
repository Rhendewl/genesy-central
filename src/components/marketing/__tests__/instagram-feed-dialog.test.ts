import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => createElement("div", null, children),
  DialogContent: ({ children }: { children: React.ReactNode }) => createElement("div", null, children),
  DialogTitle: ({ children }: { children: React.ReactNode }) => createElement("h2", null, children),
}));
vi.mock("@/components/ui/DateInput", () => ({ DateTimeInput: (props: React.InputHTMLAttributes<HTMLInputElement>) => createElement("input", props) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
import { InstagramFeedDialog } from "../InstagramFeedDialog";
let root: Root; let host: HTMLDivElement;
const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });
describe("Feed publication review", () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    sessionStorage.clear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:slide"), revokeObjectURL: vi.fn() }));
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
  it("reviews selected slides in project order and publishes only after confirmation", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({ accounts: [{ id: "a", username: "account", needsReconnect: false }] }))
      .mockResolvedValueOnce(json({ ticket: "child-ticket" })).mockResolvedValueOnce(json({ published: false, ticket: "parent-ticket" }))
      .mockResolvedValueOnce(json({ published: true }));
    vi.stubGlobal("fetch", fetcher);
    const capture = vi.fn(async (_id: string) => new Blob(["jpeg"], { type: "image/jpeg" })); const close = vi.fn();
    await act(async () => root.render(createElement(InstagramFeedDialog, { slides: [{ id: "one", number: 1 }, { id: "two", number: 2 }], capture, onClose: close })));
    expect(capture).not.toHaveBeenCalled(); expect(fetcher).toHaveBeenCalledTimes(1);
    expect(host.querySelectorAll('[aria-pressed="true"]')).toHaveLength(2);
    expect(host.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    expect(host.querySelectorAll('textarea[aria-label="Texto alternativo"]')).toHaveLength(1);
    await act(async () => (host.querySelector('[aria-label="Slide 1"]') as HTMLButtonElement).click());
    await act(async () => (host.querySelector('[aria-label="Slide 1"]') as HTMLButtonElement).click());
    const button = (label: string) => Array.from(host.querySelectorAll("button")).find((item) => item.textContent === label)!;
    await act(async () => button("Revisar publicação").click());
    expect(capture.mock.calls.map((call) => call[0])).toEqual(["one", "two"]);
    expect(host.querySelectorAll("img")).toHaveLength(2); expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => button("Publicar agora").click());
    await act(async () => { await vi.waitFor(() => expect(close).toHaveBeenCalledOnce(), { timeout: 4500 }); });
    const form = fetcher.mock.calls[1][1].body as FormData;
    expect(form.getAll("images")).toHaveLength(2); expect(form.get("connectionId")).toBe("a");
    expect(JSON.parse(fetcher.mock.calls[3][1].body)).toEqual({ ticket: "parent-ticket" });
    expect(close).toHaveBeenCalledOnce(); expect(sessionStorage.getItem("genesy-pending-instagram-feed")).toBeNull();
  });
  it("handles a non-JSON gateway timeout with a useful message", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({ accounts: [{ id: "a", username: "account", needsReconnect: false }] }))
      .mockResolvedValueOnce(new Response("Gateway Timeout", { status: 504 }));
    vi.stubGlobal("fetch", fetcher);
    const capture = vi.fn(async () => new Blob(["jpeg"], { type: "image/jpeg" }));
    await act(async () => root.render(createElement(InstagramFeedDialog, { slides: [{ id: "one", number: 1 }], capture, onClose: vi.fn() })));
    const button = (label: string) => Array.from(host.querySelectorAll("button")).find((item) => item.textContent === label)!;
    await act(async () => button("Revisar publicação").click());
    await act(async () => button("Publicar agora").click());
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("demorou para responder");
    expect(sessionStorage.getItem("genesy-pending-instagram-feed")).toBeNull();
  });
  it("preselects every slide and blocks review above the API limit", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ accounts: [{ id: "a", username: "account", needsReconnect: false }] })));
    await act(async () => root.render(createElement(InstagramFeedDialog, { slides: Array.from({ length: 11 }, (_, i) => ({ id: String(i), number: i + 1 })), capture: vi.fn(), onClose: vi.fn() })));
    expect(host.querySelectorAll('[aria-pressed="true"]')).toHaveLength(11);
    const review = Array.from(host.querySelectorAll("button")).find((item) => item.textContent === "Revisar publicação")!;
    expect(review.disabled).toBe(true);
    await act(async () => (host.querySelector('[aria-label="Slide 11"]') as HTMLButtonElement).click());
    expect(review.disabled).toBe(false);
  });

  it("schedules reviewed slides in Fortaleza time without publishing immediately", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({ accounts: [{ id: "a", username: "account", needsReconnect: false }] }))
      .mockResolvedValueOnce(json({ scheduled: true, scheduledAt: "2099-01-01T15:30:00.000Z" }));
    vi.stubGlobal("fetch", fetcher);
    const close = vi.fn();
    await act(async () => root.render(createElement(InstagramFeedDialog, { slides: [{ id: "one", number: 1 }], capture: async () => new Blob(["jpeg"], { type: "image/jpeg" }), onClose: close })));
    await act(async () => (host.querySelectorAll('input[type="radio"]')[1] as HTMLInputElement).click());
    const date = host.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(date, "2099-01-01T12:30");
      date.dispatchEvent(new Event("input", { bubbles: true })); date.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const button = (label: string) => Array.from(host.querySelectorAll("button")).find((item) => item.textContent === label)!;
    await act(async () => button("Revisar publicação").click());
    await act(async () => button("Confirmar agendamento").click());
    expect(fetcher).toHaveBeenCalledTimes(2);
    const form = fetcher.mock.calls[1][1].body as FormData;
    expect(form.get("scheduledAt")).toBe("2099-01-01T15:30:00.000Z");
    expect(form.get("scheduleId")).toBeTruthy(); expect(close).toHaveBeenCalledOnce();
  });

});
