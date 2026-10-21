import { describe, it, expect, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { useWorkspaceTasks } from "../useWorkspaceTasks";
const { db } = vi.hoisted(() => {
  const channel = { on: vi.fn(), subscribe: vi.fn() };
  channel.on.mockReturnValue(channel);
  channel.subscribe.mockReturnValue(channel);
  return { db: { channel: vi.fn(() => channel), removeChannel: vi.fn() } };
});
vi.mock("@/lib/supabase", () => ({ getSupabaseClient: () => db }));
describe("Workspace tasks connectivity", () => {
  it("reports failed fetches without leaving loading active or rejecting refetch", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Sem conexão")));
    let state: ReturnType<typeof useWorkspaceTasks> | undefined;
    function Probe() {
      state = useWorkspaceTasks();
      return null;
    }
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
      await act(async () => {
        root.render(createElement(Probe));
      });
      expect(state?.error).toBe("Sem conexão");
      expect(state?.isLoading).toBe(false);
      await act(async () => {
        await state!.refetch();
      });
      expect(state?.error).toBe("Sem conexão");
    } finally {
      await act(async () => root.unmount());
      vi.unstubAllGlobals();
    }
  });
});
