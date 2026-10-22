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
  it("returns objective tasks and links without waiting for checklist/comment enrichment",async()=>{
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);
    const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({tasks:[{id:"t",status:"a_fazer",assignee_ids:[]}],objective_links:[{id:"l",task_id:"t"}]})});vi.stubGlobal("fetch",fetcher);
    let state:ReturnType<typeof useWorkspaceTasks>|undefined;
    function Probe(){state=useWorkspaceTasks(undefined,undefined,"o",true);return null;}
    const root=createRoot(document.createElement("div"));
    try {await act(async()=>root.render(createElement(Probe)));expect(fetcher.mock.calls[0][0]).toContain("objective_only=1");expect(state?.tasks.map(t=>t.id)).toEqual(["t"]);expect(state?.objectiveLinks).toEqual([{id:"l",task_id:"t"}]);expect(state?.error).toBeNull();}
    finally {await act(async()=>root.unmount());vi.unstubAllGlobals();}
  });

});

it("isolates realtime subscriptions for simultaneous task panels", async () => {
 vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({tasks:[],objective_links:[]})}));
 db.channel.mockClear();
 function Probe(){useWorkspaceTasks(undefined,undefined,"objective",true);useWorkspaceTasks();return null;}
 const root=createRoot(document.createElement("div"));
 try {await act(async()=>{root.render(createElement(Probe));});const names=db.channel.mock.calls.map(call=>(call as unknown as [string])[0]);expect(names.length).toBe(2);expect(new Set(names).size).toBe(2);}finally{await act(async()=>root.unmount());vi.unstubAllGlobals();}
});
