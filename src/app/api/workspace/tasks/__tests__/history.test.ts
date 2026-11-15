// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const state = vi.hoisted(() => ({ tasks: [] as Record<string, unknown>[], ranges: [] as number[][] }));
vi.mock("@/lib/supabase-server", () => ({ createServerSupabaseClient: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: "self" } } }) },
  from(table: string) {
    const chain = { select: () => chain, eq: () => chain, order: () => chain, or: () => chain, in: () => chain,
      maybeSingle: async () => ({ data: null, error: null }),
      range: async (from: number, to: number) => { state.ranges.push([from,to]); return { data: state.tasks.slice(from,to+1), error: null }; },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: table === "workspace_tasks" ? state.tasks : [], error: null }).then(resolve) };
    return chain;
  },
}) }));
vi.mock("@/lib/workspace/task-authorization", () => ({ isWorkspaceAdminOfUser: async () => false }));
import { GET } from "../route";
describe("completed task history API", () => {
  beforeEach(() => { state.ranges = []; state.tasks = [{ id: "old", user_id: "self", created_by: "self", title: "Histórico", status: "concluido", completed_at: "2020-01-01T12:00:00Z" }, { id: "active", user_id: "self", created_by: "self", title: "Atual", status: "a_fazer" }]; });
  it("keeps the active-only default for existing dashboards", async () => {
    const body = await (await GET(new NextRequest("https://test.local/api/workspace/tasks"))).json();
    expect(body.tasks.map((task: {id:string}) => task.id)).toEqual(["active"]);
  });
  it("returns historical tasks when explicitly requested, with original dates", async () => {
    const body = await (await GET(new NextRequest("https://test.local/api/workspace/tasks?include_history=1"))).json();
    expect(body.tasks.map((task: {id:string}) => task.id)).toEqual(["old", "active"]);
    expect(body.tasks[0].completed_at).toBe("2020-01-01T12:00:00Z");
  });
  it("does not truncate history at the first database page", async () => {
    state.tasks = Array.from({length:501},(_,i)=>({id:String(i),user_id:"self",created_by:"self",status:"concluido",completed_at:"2020-01-01T12:00:00Z"}));
    const body = await (await GET(new NextRequest("https://test.local/api/workspace/tasks?include_history=1"))).json();
    expect(body.tasks).toHaveLength(501); expect(state.ranges).toEqual([[0,499],[500,999]]);
  });
});
