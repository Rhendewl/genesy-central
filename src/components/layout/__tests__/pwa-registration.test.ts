import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PwaRegistration } from "../PwaRegistration";
import { ensurePushSubscription } from "@/lib/notifications/push-client";
const state = vi.hoisted(() => ({ pathname: "/auth" }));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("@/lib/notifications/push-client", () => ({ ensurePushSubscription: vi.fn() }));
let root: Root;
const register = vi.fn();
const worker = { ready: Promise.resolve({ update: async () => {} }), register, addEventListener: vi.fn(), removeEventListener: vi.fn() };
async function render() { await act(async () => { root.render(createElement(PwaRegistration)); }); }
describe("push registration lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks(); state.pathname = "/auth";
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("Notification", { permission: "granted" });
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: worker });
    register.mockResolvedValue({});
    vi.mocked(ensurePushSubscription).mockResolvedValue({} as PushSubscription);
    root = createRoot(document.createElement("div"));
  });
  afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });
  it("retries registration after the login redirect even though both paths are internal", async () => {
    vi.mocked(ensurePushSubscription).mockRejectedValueOnce(new Error("Not authenticated yet"));
    await render();
    state.pathname = "/";
    await render();
    expect(ensurePushSubscription).toHaveBeenCalledTimes(2);
  });
  it("does not throttle a retry after registration fails", async () => {
    vi.mocked(ensurePushSubscription).mockRejectedValueOnce(new Error("Offline"));
    await render();
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(ensurePushSubscription).toHaveBeenCalledTimes(2);
  });
  it("does not register private notifications on the public calculator", async () => {
    state.pathname = "/simular/link";
    await render();
    expect(register).not.toHaveBeenCalled();
    expect(ensurePushSubscription).not.toHaveBeenCalled();
  });
});
