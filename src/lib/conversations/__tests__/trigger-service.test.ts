import { describe, it, expect, vi } from "vitest";
import { cancelConflictingConversationFlowJobs, enqueueConversationTrigger } from "../trigger-service";

// ── Fake Supabase client ─────────────────────────────────────────────────────
// Chain "thenable" (como o PostgrestFilterBuilder real): pode ser aguardada
// direto (select+eq+eq sem .single()) ou via .single()/.maybeSingle().

function makeChain(resolveValue: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: Record<string, any> = {};
  for (const m of ["select", "eq", "neq", "in", "or", "order", "gt", "lte", "limit", "update", "insert", "upsert"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue(resolveValue);
  chain.maybeSingle = vi.fn().mockResolvedValue(resolveValue);
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(resolveValue).then(resolve, reject);
  return chain;
}

function makeFakeDb(tables: Record<string, unknown>) {
  const chains: Record<string, ReturnType<typeof makeChain>[]> = {};
  const from = vi.fn((table: string) => {
    const chain = makeChain(tables[table] ?? { data: [], error: null });
    (chains[table] ??= []).push(chain);
    return chain;
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { db: { from } as any, chains };
}

// ── enqueueConversationTrigger() — idempotência ──────────────────────────────

describe("enqueueConversationTrigger() — dedup", () => {
  it("uses upsert with onConflict flow_id,dedupe_key and ignoreDuplicates — the DB unique index is what actually blocks the second insert", async () => {
    const { db, chains } = makeFakeDb({
      conversation_flows: {
        data: [{ id: "flow-1", user_id: "user-1", owner_profile_id: null, scope: "team", trigger_type: "form_submitted", trigger_config: {} }],
        error: null,
      },
      conversation_flow_nodes: { data: [], error: null },
      conversation_flow_edges: { data: [], error: null },
      conversation_flow_jobs: { data: [{ id: "job-1" }], error: null },
    });

    await enqueueConversationTrigger(db, {
      userId: "user-1",
      triggerType: "form_submitted",
      dedupeKey: "submission:sub-1",
      snapshot: {},
    });

    const jobsChain = chains.conversation_flow_jobs[0];
    expect(jobsChain.upsert).toHaveBeenCalledTimes(1);
    const [rows, options] = (jobsChain.upsert as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options).toEqual({ onConflict: "flow_id,dedupe_key", ignoreDuplicates: true });
    expect(rows[0].dedupe_key).toBe("submission:sub-1");
    expect(rows[0].flow_id).toBe("flow-1");
  });

  it("does not query dedupe at all when no eligible flow matches — no job attempted", async () => {
    const { db, chains } = makeFakeDb({
      conversation_flows: { data: [], error: null },
    });

    const result = await enqueueConversationTrigger(db, {
      userId: "user-1",
      triggerType: "form_submitted",
      dedupeKey: "submission:sub-1",
      snapshot: {},
    });

    expect(result.queued).toBe(0);
    expect(chains.conversation_flow_jobs).toBeUndefined();
  });
});

// ── cancelConflictingConversationFlowJobs() — cancelamento inteligente ──────

describe("cancelConflictingConversationFlowJobs()", () => {
  it("cancels pending jobs on flows that did not opt out with skip_when_scheduled: false", async () => {
    const { db, chains } = makeFakeDb({
      conversation_flow_jobs: {
        data: [
          { id: "job-keep-going", flow_id: "flow-opted-out", user_id: "user-1" },
          { id: "job-to-cancel", flow_id: "flow-default", user_id: "user-1" },
        ],
        error: null,
      },
      conversation_flows: {
        data: [
          { id: "flow-opted-out", trigger_config: { skip_when_scheduled: false } },
          { id: "flow-default", trigger_config: {} },
        ],
        error: null,
      },
      conversation_flow_logs: { data: null, error: null },
    });

    const result = await cancelConflictingConversationFlowJobs(db, {
      leadId: "lead-1",
      reason: "Lead agendou uma reunião — ação de fluxo cancelada automaticamente.",
    });

    expect(result.cancelled).toBe(1);

    // A segunda chain de conversation_flow_jobs é a do .update(...).in(...)
    const updateChain = chains.conversation_flow_jobs[1];
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled", cancelled_reason: expect.any(String) }),
    );
    expect(updateChain.in).toHaveBeenCalledWith("id", ["job-to-cancel"]);

    const logsChain = chains.conversation_flow_logs[0];
    expect(logsChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({ job_id: "job-to-cancel", flow_id: "flow-default" }),
    ]);
  });

  it("is a no-op when the lead has no pending jobs", async () => {
    const { db, chains } = makeFakeDb({
      conversation_flow_jobs: { data: [], error: null },
    });

    const result = await cancelConflictingConversationFlowJobs(db, { leadId: "lead-1", reason: "x" });

    expect(result.cancelled).toBe(0);
    expect(chains.conversation_flows).toBeUndefined();
  });
});
