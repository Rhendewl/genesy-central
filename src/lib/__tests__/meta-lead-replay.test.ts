import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ process: vi.fn() }));
vi.mock("@/lib/meta-lead-capture", () => ({ processMetaLeadEvent: mocks.process }));
import { runDueMetaLeadReplays } from "@/lib/meta-lead-replay";

type Row = { id: string; user_id: string; page_id: string; form_id: string; leadgen_id: string; status: string; run_at: string; error?: unknown };

function fakeDb(rows: Row[]) {
  const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];
  const db = {
    from: () => {
      let patch: Record<string, unknown> | null = null;
      const filters: Record<string, unknown> = {};
      let lte: string | null = null;
      const builder = {
        select: () => builder,
        update: (value: Record<string, unknown>) => { patch = value; return builder; },
        eq: (column: string, value: unknown) => { filters[column] = value; return builder; },
        lte: (_column: string, value: string) => { lte = value; return builder; },
        order: () => builder,
        limit: () => Promise.resolve({ data: rows.filter(r => r.status === filters.status && (!lte || r.run_at <= lte)), error: null }),
        maybeSingle: () => {
          const row = rows.find(r => r.id === filters.id && (!filters.status || r.status === filters.status));
          if (row && patch) { Object.assign(row, patch); updates.push({ id: row.id, patch: patch! }); }
          return Promise.resolve({ data: row ? { id: row.id } : null, error: null });
        },
        then: (resolve: (v: unknown) => void) => {
          const row = rows.find(r => r.id === filters.id);
          if (row && patch) { Object.assign(row, patch); updates.push({ id: row.id, patch: patch! }); }
          resolve({ data: null, error: null });
        },
      };
      return builder;
    },
  };
  return { db, updates };
}

describe("runDueMetaLeadReplays", () => {
  beforeEach(() => { mocks.process.mockReset(); });

  it("processes only due items through the normal capture with arrival = now", async () => {
    const rows: Row[] = [
      { id: "a", user_id: "owner", page_id: "p", form_id: "f", leadgen_id: "1", status: "pending", run_at: "2026-11-26T20:00:00.000Z" },
      { id: "b", user_id: "owner", page_id: "p", form_id: "f", leadgen_id: "2", status: "pending", run_at: "2026-11-26T23:00:00.000Z" },
    ];
    mocks.process.mockResolvedValue({ status: "processed", step: "done", lead_id: "L1" });
    const { db } = fakeDb(rows);
    const result = await runDueMetaLeadReplays(db as never, 5, new Date("2026-11-26T21:00:00.000Z"));
    expect(result).toEqual({ processed: 1, done: 1, failed: 0 });
    expect(mocks.process).toHaveBeenCalledTimes(1);
    expect(mocks.process.mock.calls[0][1]).toEqual({ page_id: "p", form_id: "f", leadgen_id: "1" });
    expect(mocks.process.mock.calls[0][3].receivedAt).toEqual(expect.any(String));
    expect(rows[0]).toMatchObject({ status: "done", lead_id: "L1" });
    expect(rows[1].status).toBe("pending");
  });

  it("records failures without throwing", async () => {
    const rows: Row[] = [{ id: "a", user_id: "owner", page_id: "p", form_id: "f", leadgen_id: "1", status: "pending", run_at: "2026-11-26T20:00:00.000Z" }];
    mocks.process.mockRejectedValue(new Error("Meta fora do ar"));
    const { db } = fakeDb(rows);
    const result = await runDueMetaLeadReplays(db as never, 5, new Date("2026-11-26T21:00:00.000Z"));
    expect(result).toEqual({ processed: 1, done: 0, failed: 1 });
    expect(rows[0].status).toBe("error");
    expect(String(rows[0].error)).toContain("Meta fora do ar");
  });
});
