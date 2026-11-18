// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ failedTable: "", error: { code: "PGRST205", message: "Missing table" } }));
vi.mock("@/lib/crm/lead-roulette", () => ({ distributeFormLead: vi.fn() }));
vi.mock("@/lib/supabase-server", () => ({ createServerSupabaseClient: async () => client() }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminSupabaseClient: () => client() }));
function client() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
    rpc: async (name: string) => ({ data: name === "effective_owner_id" ? "owner" : true }),
    from: (table: string) => {
      const result = { data: [], count: 0, error: table === mocks.failedTable ? mocks.error : null };
      const query = { select: () => query, order: () => query, eq: () => query, is: () => query, limit: () => query,
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) };
      return query;
    },
  };
}
import { GET } from "../route";
beforeEach(() => { mocks.failedTable = ""; vi.restoreAllMocks(); });
it("identifies schema cache failures without claiming the migration was not applied", async () => {
  mocks.failedTable = "crm_lead_roulettes";
  vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "Não foi possível carregar roletas. Tente novamente. Código: PGRST205." });
});
it("returns the configuration when all reads succeed", async () => {
  const response = await GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ roulettes: [], pendingCount: 0 });
});
