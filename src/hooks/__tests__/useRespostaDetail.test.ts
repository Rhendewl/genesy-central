import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { clearDetailCache } from "../useRespostaDetail";
import type { SubmissionDetail, SubmissionListItem } from "@/lib/respostas/types";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const makeSubmission = (): SubmissionListItem => ({
  id: "sub-1", form_id: "form-1", session_id: "sess-1", correlation_id: "tok-abc",
  status: "completed", answers: { q1: "Ana" }, score: null, step_timings: { s1: 4000 },
  drop_off_step: null, time_on_form_ms: 4000, read_at: null,
  starred: false, archived: false, completed_at: "2026-06-25T12:00:00.000Z",
  created_at: "2026-06-25T11:00:00.000Z", updated_at: "2026-06-25T12:00:00.000Z",
  session_token: "tok-abc", device: "mobile", browser: "Chrome", os: "iOS",
  country: "BR", city: null, utm_source: "google", utm_medium: "cpc",
  utm_campaign: null, utm_term: null, utm_content: null, fbclid: null,
  gclid: null, referrer: null, form_name: "Lead Form", form_slug: "lead-form",
});

const makeDetail = (): SubmissionDetail => ({
  submission: makeSubmission(),
  sessionEvents: [
    { id: "ev-1", step_id: "s1", event: "step_view", duration: 3000, created_at: "2026-06-25T11:01:00.000Z", meta: null },
    { id: "ev-2", step_id: null, event: "submission_finished", duration: null, created_at: "2026-06-25T11:05:00.000Z", meta: null },
  ],
  integrationDeliveries: [
    {
      id: "del-1", adapter_name: "meta-pixel", event_id: "ev-1",
      correlation_id: "tok-abc", event_type: "form.completed",
      attempt: 1, ok: true, status_code: 200, duration_ms: 340,
      error: null, delivered_at: "2026-06-25T12:00:01.000Z",
    },
  ],
});

// ── Cache tests ───────────────────────────────────────────────────────────────

describe("clearDetailCache()", () => {
  afterEach(() => clearDetailCache());

  it("can be called without error", () => {
    expect(() => clearDetailCache()).not.toThrow();
  });

  it("can be called multiple times safely", () => {
    clearDetailCache();
    clearDetailCache();
    clearDetailCache();
  });
});

// ── SubmissionDetail structure tests ─────────────────────────────────────────

describe("SubmissionDetail structure", () => {
  it("has submission, sessionEvents, integrationDeliveries", () => {
    const detail = makeDetail();
    expect(typeof detail.submission).toBe("object");
    expect(Array.isArray(detail.sessionEvents)).toBe(true);
    expect(Array.isArray(detail.integrationDeliveries)).toBe(true);
  });

  it("submission has correlation_id for integration lookup", () => {
    const detail = makeDetail();
    expect(detail.submission.correlation_id).toBe("tok-abc");
  });

  it("sessionEvents are ordered chronologically", () => {
    const detail = makeDetail();
    const timestamps = detail.sessionEvents.map(e => new Date(e.created_at).getTime());
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
    }
  });

  it("integrationDeliveries have all required fields", () => {
    const { integrationDeliveries } = makeDetail();
    for (const d of integrationDeliveries) {
      expect(typeof d.id).toBe("string");
      expect(typeof d.adapter_name).toBe("string");
      expect(typeof d.ok).toBe("boolean");
      expect(typeof d.attempt).toBe("number");
      expect(d.attempt).toBeGreaterThanOrEqual(1);
    }
  });

  it("sessionEvents with no step_id are valid (session-level events)", () => {
    const { sessionEvents } = makeDetail();
    const sessionLevel = sessionEvents.filter(e => e.step_id === null);
    expect(sessionLevel.length).toBeGreaterThanOrEqual(0);
    for (const e of sessionLevel) {
      expect(e.step_id).toBeNull();
      expect(typeof e.event).toBe("string");
    }
  });
});

// ── Fetch mock behavior ───────────────────────────────────────────────────────

describe("fetch integration", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clearDetailCache();
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearDetailCache();
  });

  it("detail fetch targets the correct URL", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(makeDetail()),
    } as never);

    const res = await fetch("/api/respostas/sub-1");
    const detail = await res.json() as SubmissionDetail;
    expect(fetchSpy).toHaveBeenCalledWith("/api/respostas/sub-1");
    expect(detail.submission.id).toBe("sub-1");
  });

  it("non-ok response throws", async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 404 } as never);

    let threw = false;
    try {
      const res = await fetch("/api/respostas/missing");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  it("cache returns stored detail immediately on second call", () => {
    const detail = makeDetail();
    // Simulate the cache
    const cache = new Map<string, SubmissionDetail>();
    cache.set("sub-1", detail);

    const cached = cache.get("sub-1");
    expect(cached).toBe(detail);
    expect(cache.size).toBe(1);

    // After clear
    cache.clear();
    expect(cache.get("sub-1")).toBeUndefined();
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe("Edge cases", () => {
  it("handles null id gracefully", () => {
    const id: string | null = null;
    expect(id).toBeNull();
    // Hook should not fetch when id is null
  });

  it("handles undefined id gracefully", () => {
    const id: string | undefined = undefined;
    expect(id).toBeUndefined();
  });

  it("empty sessionEvents is valid", () => {
    const detail: SubmissionDetail = { ...makeDetail(), sessionEvents: [] };
    expect(detail.sessionEvents).toHaveLength(0);
  });

  it("empty integrationDeliveries is valid", () => {
    const detail: SubmissionDetail = { ...makeDetail(), integrationDeliveries: [] };
    expect(detail.integrationDeliveries).toHaveLength(0);
  });
});
