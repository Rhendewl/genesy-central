import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockUser = { id: "user-123" };

const mockSub = {
  id: "sub-1", form_id: "form-1", session_id: "sess-1",
  user_id: "user-123", correlation_id: null, status: "completed",
  answers: { q1: "Ana" }, score: null, step_timings: {}, drop_off_step: null,
  time_on_form_ms: 4000, read_at: null, starred: false, archived: false,
  completed_at: "2026-06-25T12:00:00.000Z",
  created_at: "2026-06-25T11:00:00.000Z", updated_at: "2026-06-25T12:00:00.000Z",
};

const mockSession = {
  id: "sess-1", token: "tok-abc", device: "mobile", browser: "Chrome",
  os: "iOS", country: "BR", city: null, utm_source: null, utm_medium: null,
  utm_campaign: null, utm_term: null, utm_content: null, fbclid: null,
  gclid: null, referrer: null,
};

const mockForm = { name: "Lead Form", slug: "lead-form" };

const mockEvent = {
  id: "ev-1", step_id: "step-1", event: "step_view",
  duration: 3000, created_at: "2026-06-25T11:01:00.000Z", meta: null,
};

const mockDelivery = {
  id: "del-1", adapter_name: "meta-pixel", event_id: "ev-1",
  correlation_id: "tok-abc", event_type: "form.completed",
  attempt: 1, ok: true, status_code: 200, duration_ms: 340,
  error: null, delivered_at: "2026-06-25T12:00:01.000Z",
};

function buildDetailClient(opts: { user?: typeof mockUser | null; subError?: boolean } = {}) {
  const user = opts.user !== undefined ? opts.user : mockUser;
  const subData = opts.subError ? null : mockSub;
  const subErr  = opts.subError ? { message: "not found" } : null;

  const makeSingleChain = (data: unknown, error: unknown) => ({
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    order:  vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    limit:  vi.fn().mockResolvedValue({ data: [data].filter(Boolean), error }),
  });

  const sessionChain = makeSingleChain(mockSession, null);
  const formChain    = makeSingleChain(mockForm, null);
  const subChain     = makeSingleChain(subData, subErr);

  const eventsChain = {
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    order:  vi.fn().mockResolvedValue({ data: [mockEvent], error: null }),
  };

  const deliveriesChain = {
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    order:  vi.fn().mockResolvedValue({ data: [mockDelivery], error: null }),
  };

  const updateChain = {
    update: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { ...mockSub, starred: true }, error: null }),
  };

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn((table: string) => {
      if (table === "form_submissions") {
        // PATCH uses update(), GET uses select()
        return {
          ...subChain,
          update: updateChain.update.mockReturnValue(updateChain),
        };
      }
      if (table === "form_sessions")        return sessionChain;
      if (table === "forms")                return formChain;
      if (table === "form_events")          return eventsChain;
      if (table === "integration_deliveries") return deliveriesChain;
      return subChain;
    }),
  };
}

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: vi.fn(() => Promise.resolve(buildDetailClient())),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: () => {} }),
}));

// ── GET tests ─────────────────────────────────────────────────────────────────

describe("GET /api/respostas/:id", () => {
  afterEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    const { createServerSupabaseClient } = await import("@/lib/supabase-server");
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      buildDetailClient({ user: null }) as never
    );
    const { GET } = await import("../../../app/api/respostas/[id]/route");
    const req = new NextRequest("http://localhost/api/respostas/sub-1");
    const res = await GET(req, { params: Promise.resolve({ id: "sub-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when submission not found", async () => {
    const { createServerSupabaseClient } = await import("@/lib/supabase-server");
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      buildDetailClient({ subError: true }) as never
    );
    const { GET } = await import("../../../app/api/respostas/[id]/route");
    const req = new NextRequest("http://localhost/api/respostas/missing");
    const res = await GET(req, { params: Promise.resolve({ id: "missing" }) });
    expect(res.status).toBe(404);
  });

  it("returns submission, sessionEvents, integrationDeliveries", async () => {
    const { createServerSupabaseClient } = await import("@/lib/supabase-server");
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      buildDetailClient() as never
    );
    const { GET } = await import("../../../app/api/respostas/[id]/route");
    const req = new NextRequest("http://localhost/api/respostas/sub-1");
    const res = await GET(req, { params: Promise.resolve({ id: "sub-1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.submission).toBe("object");
    expect(Array.isArray(body.sessionEvents)).toBe(true);
    expect(Array.isArray(body.integrationDeliveries)).toBe(true);
  });

  it("submission has form_name and form_slug merged", async () => {
    const { createServerSupabaseClient } = await import("@/lib/supabase-server");
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      buildDetailClient() as never
    );
    const { GET } = await import("../../../app/api/respostas/[id]/route");
    const req = new NextRequest("http://localhost/api/respostas/sub-1");
    const res = await GET(req, { params: Promise.resolve({ id: "sub-1" }) });
    const body = await res.json();
    expect(body.submission.form_name).toBe("Lead Form");
    expect(body.submission.form_slug).toBe("lead-form");
  });
});

// ── PATCH tests ───────────────────────────────────────────────────────────────

describe("PATCH /api/respostas/:id", () => {
  afterEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    const { createServerSupabaseClient } = await import("@/lib/supabase-server");
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      buildDetailClient({ user: null }) as never
    );
    const { PATCH } = await import("../../../app/api/respostas/[id]/route");
    const req = new NextRequest("http://localhost/api/respostas/sub-1", {
      method: "PATCH",
      body: JSON.stringify({ starred: true }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "sub-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 400 when no valid fields provided", async () => {
    const { createServerSupabaseClient } = await import("@/lib/supabase-server");
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      buildDetailClient() as never
    );
    const { PATCH } = await import("../../../app/api/respostas/[id]/route");
    const req = new NextRequest("http://localhost/api/respostas/sub-1", {
      method: "PATCH",
      body: JSON.stringify({ unknown_field: true }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "sub-1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid status value", async () => {
    const { createServerSupabaseClient } = await import("@/lib/supabase-server");
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      buildDetailClient() as never
    );
    const { PATCH } = await import("../../../app/api/respostas/[id]/route");
    const req = new NextRequest("http://localhost/api/respostas/sub-1", {
      method: "PATCH",
      body: JSON.stringify({ status: "invalid_status" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "sub-1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 200 and updated submission on valid patch", async () => {
    const { createServerSupabaseClient } = await import("@/lib/supabase-server");
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      buildDetailClient() as never
    );
    const { PATCH } = await import("../../../app/api/respostas/[id]/route");
    const req = new NextRequest("http://localhost/api/respostas/sub-1", {
      method: "PATCH",
      body: JSON.stringify({ starred: true }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "sub-1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.submission).toBeDefined();
  });

  it("auto-sets read_at when starring", async () => {
    let patchSentToDb: Record<string, unknown> | null = null;

    const updateResultChain = {
      eq:     vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { ...mockSub, starred: true, read_at: new Date().toISOString() },
        error: null,
      }),
    };
    const updateSpy = vi.fn().mockImplementation((p: Record<string, unknown>) => {
      patchSentToDb = p;
      return updateResultChain;
    });

    const baseClient = buildDetailClient();
    const originalFrom = baseClient.from;
    baseClient.from = vi.fn((table: string) => {
      if (table !== "form_submissions") return originalFrom(table);
      return { ...originalFrom(table), update: updateSpy };
    });

    const { createServerSupabaseClient } = await import("@/lib/supabase-server");
    vi.mocked(createServerSupabaseClient).mockResolvedValue(baseClient as never);

    const { PATCH } = await import("../../../app/api/respostas/[id]/route");
    const req = new NextRequest("http://localhost/api/respostas/sub-1", {
      method: "PATCH",
      body: JSON.stringify({ starred: true }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "sub-1" }) });
    expect(res.status).toBe(200);
    expect(patchSentToDb).not.toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const sent = patchSentToDb! as Record<string, unknown>;
    expect(sent.starred).toBe(true);
    expect(typeof sent.read_at).toBe("string");
  });

  it("accepts all valid status values", async () => {
    const validStatuses = ["partial", "started", "completed", "spam", "abandoned"];
    for (const status of validStatuses) {
      const { createServerSupabaseClient } = await import("@/lib/supabase-server");
      vi.mocked(createServerSupabaseClient).mockResolvedValue(
        buildDetailClient() as never
      );
      const { PATCH } = await import("../../../app/api/respostas/[id]/route");
      const req = new NextRequest("http://localhost/api/respostas/sub-1", {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      const res = await PATCH(req, { params: Promise.resolve({ id: "sub-1" }) });
      expect(res.status).not.toBe(400);
    }
  });
});
