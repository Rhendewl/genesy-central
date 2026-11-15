import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ user: "", calls: [] as { table: string; operation: string; filters: Record<string, string>; payload?: Record<string, unknown> }[] }));
vi.mock("@/lib/supabase", () => {
  const db = {
    auth: { getSession: async () => ({ data: { session: { user: { id: state.user } } } }), getUser: async () => ({ data: { user: { id: state.user } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    from(table: string) {
      const call = { table, operation: "select", filters: {} as Record<string, string>, payload: undefined as Record<string, unknown> | undefined };
      state.calls.push(call);
      const result = () => ({ data: [{ id: "shared-id", name: call.filters.pipeline_id || "global", color: "#123456" }], error: null });
      const chain = { select: () => chain, order: () => chain, eq: (key: string, value: string) => { call.filters[key] = value; return chain; },
        insert: (payload: Record<string, unknown>) => { call.operation = "insert"; call.payload = payload; return chain; },
        update: (payload: Record<string, unknown>) => { call.operation = "update"; call.payload = payload; return chain; },
        delete: () => { call.operation = "delete"; return chain; }, single: async () => ({ data: result().data[0], error: null }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve) };
      return chain;
    },
  };
  return { getSupabaseClient: () => db };
});
import { useTags } from "../useTags";
let root: Root; let host: HTMLDivElement;
let a: ReturnType<typeof useTags>; let b: ReturnType<typeof useTags>;
function Harness({ pipeline = "a" }: { pipeline?: string }) { a = useTags("crm", pipeline); b = useTags("crm", "b"); return null; }
describe("pipeline tag catalog", () => {
  beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_CRM_PIPELINE_TAGS_ENABLED", "true"); Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); state.user = crypto.randomUUID(); state.calls = []; host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllEnvs(); });
  it("does not share cached results between pipelines or show the previous pipeline after switching", async () => {
    await act(async () => root.render(createElement(Harness)));
    expect(a.tags[0].name).toBe("a"); expect(b.tags[0].name).toBe("b");
    await act(async () => root.render(createElement(Harness, { pipeline: "c" })));
    expect(a.tags[0].name).toBe("c"); expect(b.tags[0].name).toBe("b");
  });
  it("scopes creation, renaming and deletion to the selected pipeline", async () => {
    await act(async () => root.render(createElement(Harness)));
    await act(async () => { await a.createTag({ name: "VIP", color: "#123456" }); });
    expect(state.calls.find((call) => call.operation === "insert")).toMatchObject({ table: "crm_pipeline_tags", payload: { pipeline_id: "a", name: "VIP" } });
    await act(async () => { await a.updateTag("shared-id", { name: "Novo nome" }); await a.deleteTag("shared-id"); });
    for (const call of state.calls.filter((call) => ["update", "delete"].includes(call.operation))) expect(call.filters).toEqual({ id: "shared-id", pipeline_id: "a" });
  });
});
