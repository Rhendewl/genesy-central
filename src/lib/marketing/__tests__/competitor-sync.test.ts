// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
const m = vi.hoisted(() => ({ discover: vi.fn(), config: vi.fn() }));
vi.mock("../competitor-discovery", () => ({
  discover: m.discover,
  discoveryConfig: m.config,
}));
import { syncCompetitor } from "../competitor-sync";
function database(
  profile: unknown = { username: "target", instagram_id: "9" },
) {
  const chain = {
    update: vi.fn(),
    eq: vi.fn(),
    lte: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null }),
    then: (resolve: (r: unknown) => unknown) =>
      Promise.resolve({ error: null }).then(resolve),
  };
  for (const key of ["update", "eq", "lte", "select"] as const)
    chain[key].mockReturnValue(chain);
  const db = {
    from: vi.fn(() => chain),
    rpc: vi.fn().mockResolvedValue({ error: null }),
  };
  return { db, chain };
}
beforeEach(() => {
  vi.clearAllMocks();
  m.discover.mockResolvedValue({ instagram_id: "9", posts: [{ id: "1" }] });
});
describe("Daily synchronization", () => {
  it("does not call Meta when an atomic claim fails", async () => {
    const { db } = database(null);
    await expect(
      syncCompetitor(db as unknown as SupabaseClient, "org", "id"),
    ).rejects.toMatchObject({ status: 409 });
    expect(m.discover).not.toHaveBeenCalled();
  });
  it("scopes claim and transaction to the authenticated organization", async () => {
    const { db, chain } = database();
    expect(
      await syncCompetitor(db as unknown as SupabaseClient, "org", "id"),
    ).toEqual({ collected: 1 });
    expect(chain.eq).toHaveBeenCalledWith("organization_id", "org");
    expect(chain.eq).toHaveBeenCalledWith("active", true);
    expect(db.rpc).toHaveBeenCalledWith("save_competitor_observation", {
      p_id: "id",
      p_org: "org",
      p_data: expect.anything(),
    });
  });
  it("does not mix historical data when an Instagram username changes owner", async () => {
    const { db } = database();
    m.discover.mockResolvedValue({ instagram_id: "other", posts: [] });
    await expect(
      syncCompetitor(db as unknown as SupabaseClient, "org", "id"),
    ).rejects.toMatchObject({ status: 409 });
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("defers the organization on rate limit and persists a sanitized error", async () => {
    const { db, chain } = database();
    m.discover.mockRejectedValue(
      Object.assign(new Error("Limite da Meta"), { status: 429 }),
    );
    await expect(
      syncCompetitor(db as unknown as SupabaseClient, "org", "id"),
    ).rejects.toMatchObject({ status: 429 });
    expect(chain.update).toHaveBeenCalledTimes(3);
    expect(chain.update).toHaveBeenLastCalledWith({
      sync_error: "Limite da Meta",
    });
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("does not expose transport errors containing credentials", async () => {
    const { db, chain } = database();
    m.discover.mockRejectedValue(new Error("secret token transport failure"));
    await expect(
      syncCompetitor(db as unknown as SupabaseClient, "org", "id"),
    ).rejects.not.toThrow("secret");
    expect(chain.update).toHaveBeenLastCalledWith({
      sync_error: expect.not.stringContaining("secret"),
    });
  });
});
