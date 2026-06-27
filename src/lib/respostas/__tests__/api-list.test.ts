import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockUser = { id: "user-123" };

const makeSbChain = (resolveValue: unknown) => {
  const chain: Record<string, (...args: unknown[]) => unknown> = {};
  const methods = [
    "select", "eq", "neq", "in", "or", "order", "limit",
    "single", "not", "textSearch",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  (chain.limit as ReturnType<typeof vi.fn>).mockResolvedValue(resolveValue);
  (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue(resolveValue);
  return chain;
};

let mockSbClient: ReturnType<typeof buildMockClient>;

function buildMockClient(opts: {
  submissions?:    unknown[];
  submissionCount?: number;
  sessions?:       unknown[];
  forms?:          unknown[];
}) {
  const submissions = opts.submissions ?? [];
  const sessionData = opts.sessions    ?? [];
  const formData    = opts.forms       ?? [];
  const count       = opts.submissionCount ?? submissions.length;

  const dataChain = makeSbChain({ data: submissions, count, error: null });

  // Stats returned by get_submission_stats RPC
  const statsData = [{ total: count, completed: count, abandoned: 0 }];

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
    // rpc("get_submission_stats", ...) → single-pass aggregate
    rpc: vi.fn().mockResolvedValue({ data: statsData, error: null }),
    from: vi.fn((table: string) => {
      if (table === "form_submissions") return dataChain;
      if (table === "form_sessions")
        return makeSbChain({ data: sessionData, error: null });
      if (table === "forms")
        return makeSbChain({ data: formData, error: null });
      return makeSbChain({ data: [], error: null });
    }),
  };
}

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: vi.fn(() => Promise.resolve(mockSbClient)),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: () => {} }),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/respostas", () => {
  beforeEach(() => {
    const mockSub = {
      id: "sub-1", form_id: "form-1", session_id: "sess-1",
      correlation_id: null, status: "completed", answers: { q1: "Ana" },
      score: null, step_timings: {}, drop_off_step: null, time_on_form_ms: 4000,
      read_at: null, starred: false, archived: false,
      completed_at: "2026-06-25T12:00:00.000Z",
      created_at: "2026-06-25T11:00:00.000Z", updated_at: "2026-06-25T12:00:00.000Z",
    };
    const mockSession = {
      id: "sess-1", token: "tok-abc", device: "mobile", browser: "Chrome",
      os: "iOS", country: "BR", city: null, utm_source: "google",
      utm_medium: "cpc", utm_campaign: null, utm_term: null, utm_content: null,
      fbclid: null, gclid: null, referrer: null,
    };
    const mockForm = { id: "form-1", name: "Lead Form", slug: "lead-form" };

    mockSbClient = buildMockClient({
      submissions:     [mockSub],
      submissionCount: 1,
      sessions:        [mockSession],
      forms:           [mockForm],
    });
  });

  afterEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockSbClient.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null } });
    const { GET } = await import("../../../app/api/respostas/route");
    const req = new NextRequest("http://localhost/api/respostas");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns items, nextCursor and stats on success", async () => {
    const { GET } = await import("../../../app/api/respostas/route");
    const req = new NextRequest("http://localhost/api/respostas");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect("nextCursor" in body).toBe(true);
    expect(typeof body.stats).toBe("object");
    expect(typeof body.stats.total).toBe("number");
    expect(typeof body.stats.completionRate).toBe("number");
  });

  it("calls rpc get_submission_stats with correct params", async () => {
    const { GET } = await import("../../../app/api/respostas/route");
    const req = new NextRequest("http://localhost/api/respostas?form_id=form-1");
    await GET(req);
    expect(mockSbClient.rpc).toHaveBeenCalledWith(
      "get_submission_stats",
      expect.objectContaining({ p_user_id: "user-123", p_archived: false }),
    );
  });

  it("stats use rpc result — completionRate = completed / total", async () => {
    mockSbClient.rpc = vi.fn().mockResolvedValue({
      data: [{ total: 10, completed: 7, abandoned: 3 }],
      error: null,
    });
    const { GET } = await import("../../../app/api/respostas/route");
    const req = new NextRequest("http://localhost/api/respostas");
    const res = await GET(req);
    const body = await res.json();
    expect(body.stats.total).toBe(10);
    expect(body.stats.completed).toBe(7);
    expect(body.stats.abandoned).toBe(3);
    expect(body.stats.completionRate).toBeCloseTo(0.7);
  });

  it("stats pass form_id to rpc (null when not provided)", async () => {
    const { GET } = await import("../../../app/api/respostas/route");
    const req = new NextRequest("http://localhost/api/respostas");
    await GET(req);
    expect(mockSbClient.rpc).toHaveBeenCalledWith(
      "get_submission_stats",
      expect.objectContaining({ p_form_id: null }),
    );
  });

  it("passes form_id filter to data query", async () => {
    const { GET } = await import("../../../app/api/respostas/route");
    const req = new NextRequest("http://localhost/api/respostas?form_id=form-abc");
    await GET(req);
    expect(mockSbClient.from).toHaveBeenCalledWith("form_submissions");
  });

  it("accepts cursor query param", async () => {
    const { encodeCursor } = await import("../../respostas/cursor");
    const cursor = encodeCursor("2026-06-25T11:00:00.000Z", "sub-1");
    const { GET } = await import("../../../app/api/respostas/route");
    const req = new NextRequest(`http://localhost/api/respostas?cursor=${cursor}`);
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it("rejects invalid cursors gracefully (treats as no cursor)", async () => {
    const { GET } = await import("../../../app/api/respostas/route");
    const req = new NextRequest("http://localhost/api/respostas?cursor=INVALID!!!");
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it("completionRate is in [0,1]", async () => {
    const { GET } = await import("../../../app/api/respostas/route");
    const req = new NextRequest("http://localhost/api/respostas");
    const res = await GET(req);
    const body = await res.json();
    expect(body.stats.completionRate).toBeGreaterThanOrEqual(0);
    expect(body.stats.completionRate).toBeLessThanOrEqual(1);
  });

  it("completionRate = 0 when total = 0", async () => {
    mockSbClient.rpc = vi.fn().mockResolvedValue({
      data: [{ total: 0, completed: 0, abandoned: 0 }],
      error: null,
    });
    const { GET } = await import("../../../app/api/respostas/route");
    const req = new NextRequest("http://localhost/api/respostas");
    const res = await GET(req);
    const body = await res.json();
    expect(body.stats.completionRate).toBe(0);
  });

  it("stats are not filtered by status param — uses rpc not count queries", async () => {
    // The rpc is always called regardless of status filter,
    // and it does NOT apply the status filter (only user_id, archived, form_id).
    const { GET } = await import("../../../app/api/respostas/route");
    const req = new NextRequest("http://localhost/api/respostas?status=completed");
    const res = await GET(req);
    expect(res.status).toBe(200);
    // rpc was called (not per-status count queries)
    expect(mockSbClient.rpc).toHaveBeenCalledWith("get_submission_stats", expect.any(Object));
    const body = await res.json();
    expect(body.stats.completionRate).toBeGreaterThanOrEqual(0);
    expect(body.stats.completionRate).toBeLessThanOrEqual(1);
  });

  it("respects archived=0 default filter", async () => {
    const { GET } = await import("../../../app/api/respostas/route");
    const req = new NextRequest("http://localhost/api/respostas?archived=0");
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it("gracefully handles rpc error — returns stats=zeros, not 500", async () => {
    mockSbClient.rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "function not found" },
    });
    const { GET } = await import("../../../app/api/respostas/route");
    const req = new NextRequest("http://localhost/api/respostas");
    const res = await GET(req);
    // Data query should still succeed even if stats fail
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stats.total).toBe(0);
    expect(body.stats.completionRate).toBe(0);
  });
});
