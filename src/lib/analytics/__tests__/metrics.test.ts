import { describe, it, expect } from "vitest";
import {
  buildBreakdown,
  buildTimeSeries,
  computeAvgDurationSeconds,
  computeAvgTimePerStep,
  computeAvgCompletionPct,
  computeConversionRate,
  computeAbandonmentRate,
  computeScoreDistribution,
  buildSourceBreakdown,
  buildReferrerBreakdown,
  computeStepMetrics,
} from "../metrics";
import type { RawEventRow, RawSessionRow, RawSubmissionRow } from "../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<RawSessionRow> = {}): RawSessionRow {
  return {
    device: "desktop", browser: "Chrome", os: "macOS", language: "pt",
    country: null, city: null, utm_source: null, utm_medium: null,
    utm_campaign: null, utm_term: null, utm_content: null, referrer: null,
    steps_completed: 0, is_partial: true,
    started_at: "2026-01-01T10:00:00Z", finished_at: null, abandoned_at: null,
    ...overrides,
  };
}

function makeEvent(event: string, overrides: Partial<RawEventRow> = {}): RawEventRow {
  return {
    event,
    step_id:    null,
    duration:   null,
    meta:       null,
    created_at: "2026-06-01T10:00:00Z",
    ...overrides,
  };
}

function makeSubmission(overrides: Partial<RawSubmissionRow> = {}): RawSubmissionRow {
  return {
    status:     "completed",
    score:      null,
    created_at: "2026-06-01T10:00:00Z",
    ...overrides,
  };
}

// ── buildBreakdown ────────────────────────────────────────────────────────────

describe("buildBreakdown()", () => {
  it("returns empty array for empty input", () => {
    expect(buildBreakdown([])).toHaveLength(0);
  });

  it("counts occurrences correctly", () => {
    const result = buildBreakdown(["a", "b", "a", "a"]);
    const a = result.find(r => r.label === "a")!;
    expect(a.count).toBe(3);
    expect(a.percentage).toBe(75);
  });

  it("sorts by count descending", () => {
    const result = buildBreakdown(["b", "b", "b", "a", "a"]);
    expect(result[0].label).toBe("b");
    expect(result[1].label).toBe("a");
  });

  it("uses fallback label for null/undefined values", () => {
    const result = buildBreakdown([null, undefined, "x"]);
    const fallback = result.find(r => r.label === "Desconhecido");
    expect(fallback?.count).toBe(2);
  });

  it("accepts custom fallback", () => {
    const result = buildBreakdown([null], "direto");
    expect(result[0].label).toBe("direto");
  });

  it("percentages sum to 100", () => {
    const result = buildBreakdown(["a", "b", "c", "d"]);
    const sum = result.reduce((a, b) => a + b.percentage, 0);
    expect(sum).toBeLessThanOrEqual(100);
  });
});

// ── buildTimeSeries ───────────────────────────────────────────────────────────

describe("buildTimeSeries()", () => {
  it("returns empty array for empty input", () => {
    expect(buildTimeSeries([])).toHaveLength(0);
  });

  it("groups by date", () => {
    const rows = [
      { created_at: "2026-06-01T10:00:00Z" },
      { created_at: "2026-06-01T14:00:00Z" },
      { created_at: "2026-06-02T10:00:00Z" },
    ];
    const result = buildTimeSeries(rows, 30);
    expect(result).toHaveLength(2);
    const june1 = result.find(r => r.date === "2026-06-01")!;
    expect(june1.value).toBe(2);
  });

  it("sorts by date ascending", () => {
    const rows = [
      { created_at: "2026-06-03T10:00:00Z" },
      { created_at: "2026-06-01T10:00:00Z" },
    ];
    const result = buildTimeSeries(rows, 30);
    expect(result[0].date).toBe("2026-06-01");
    expect(result[1].date).toBe("2026-06-03");
  });

  it("limits to `days` most recent entries", () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({
      created_at: `2026-01-${String(i + 1).padStart(2, "0")}T10:00:00Z`,
    })).filter(r => r.created_at.includes("2026-01-"));
    const result = buildTimeSeries(rows, 5);
    expect(result.length).toBeLessThanOrEqual(5);
  });
});

// ── computeAvgDurationSeconds ──────────────────────────────────────────────────

describe("computeAvgDurationSeconds()", () => {
  it("returns 0 for empty sessions", () => {
    expect(computeAvgDurationSeconds([])).toBe(0);
  });

  it("returns 0 when no session has finished_at", () => {
    expect(computeAvgDurationSeconds([makeSession()])).toBe(0);
  });

  it("computes average across completed sessions", () => {
    const sessions = [
      makeSession({ started_at: "2026-06-01T10:00:00Z", finished_at: "2026-06-01T10:01:00Z" }),  // 60s
      makeSession({ started_at: "2026-06-01T10:00:00Z", finished_at: "2026-06-01T10:02:00Z" }),  // 120s
    ];
    expect(computeAvgDurationSeconds(sessions)).toBe(90);
  });

  it("ignores partial sessions (no finished_at)", () => {
    const sessions = [
      makeSession({ started_at: "2026-06-01T10:00:00Z", finished_at: "2026-06-01T10:01:00Z" }),
      makeSession(), // no finished_at
    ];
    expect(computeAvgDurationSeconds(sessions)).toBe(60);
  });
});

// ── computeAvgTimePerStep ─────────────────────────────────────────────────────

describe("computeAvgTimePerStep()", () => {
  it("returns empty object when no step_completed events", () => {
    const events = [makeEvent("step_view", { step_id: "s1" })];
    expect(computeAvgTimePerStep(events)).toEqual({});
  });

  it("averages duration for each step", () => {
    const events = [
      makeEvent("step_completed", { step_id: "s1", duration: 10 }),
      makeEvent("step_completed", { step_id: "s1", duration: 20 }),
      makeEvent("step_completed", { step_id: "s2", duration: 30 }),
    ];
    const result = computeAvgTimePerStep(events);
    expect(result["s1"]).toBe(15);
    expect(result["s2"]).toBe(30);
  });

  it("ignores step_completed events without duration", () => {
    const events = [
      makeEvent("step_completed", { step_id: "s1", duration: null }),
    ];
    expect(computeAvgTimePerStep(events)).toEqual({});
  });
});

// ── computeAvgCompletionPct ───────────────────────────────────────────────────

describe("computeAvgCompletionPct()", () => {
  it("returns 0 when no sessions", () => {
    expect(computeAvgCompletionPct([], 5)).toBe(0);
  });

  it("returns 0 when totalSteps is 0", () => {
    expect(computeAvgCompletionPct([makeSession({ steps_completed: 3 })], 0)).toBe(0);
  });

  it("computes average completion percentage", () => {
    const sessions = [
      makeSession({ steps_completed: 5 }),  // 100% of 5
      makeSession({ steps_completed: 0 }),  // 0%
    ];
    expect(computeAvgCompletionPct(sessions, 5)).toBe(50);
  });

  it("rounds to nearest integer", () => {
    const sessions = [makeSession({ steps_completed: 1 })]; // 1/3 = 33.3%
    expect(computeAvgCompletionPct(sessions, 3)).toBe(33);
  });
});

// ── computeConversionRate / computeAbandonmentRate ────────────────────────────

describe("computeConversionRate()", () => {
  it("returns 0 when starts is 0", () => {
    expect(computeConversionRate(0, 5)).toBe(0);
  });
  it("computes correct rate", () => {
    expect(computeConversionRate(100, 25)).toBe(25);
  });
  it("caps at 100% (rounding)", () => {
    expect(computeConversionRate(10, 10)).toBe(100);
  });
});

describe("computeAbandonmentRate()", () => {
  it("returns 0 when starts is 0", () => {
    expect(computeAbandonmentRate(0, 0)).toBe(0);
  });
  it("computes correct rate", () => {
    expect(computeAbandonmentRate(100, 25)).toBe(75);
  });
  it("returns 0 when all start → convert", () => {
    expect(computeAbandonmentRate(10, 10)).toBe(0);
  });
});

// ── computeScoreDistribution ──────────────────────────────────────────────────

describe("computeScoreDistribution()", () => {
  it("returns null for no submissions with scores", () => {
    expect(computeScoreDistribution([makeSubmission({ score: null })])).toBeNull();
  });

  it("computes min, max, avg, median", () => {
    const submissions = [
      makeSubmission({ score: 10 }),
      makeSubmission({ score: 20 }),
      makeSubmission({ score: 30 }),
    ];
    const result = computeScoreDistribution(submissions)!;
    expect(result.min).toBe(10);
    expect(result.max).toBe(30);
    expect(result.avg).toBe(20);
    expect(result.median).toBe(20);
  });

  it("returns 5 buckets", () => {
    const submissions = Array.from({ length: 10 }, (_, i) => makeSubmission({ score: i * 10 }));
    expect(computeScoreDistribution(submissions)!.buckets).toHaveLength(5);
  });

  it("returns single bucket when all scores are equal", () => {
    const submissions = [
      makeSubmission({ score: 50 }),
      makeSubmission({ score: 50 }),
    ];
    const result = computeScoreDistribution(submissions)!;
    expect(result.min).toBe(50);
    expect(result.max).toBe(50);
    expect(result.avg).toBe(50);
  });
});

// ── buildSourceBreakdown ──────────────────────────────────────────────────────

describe("buildSourceBreakdown()", () => {
  it("groups by utm_source, defaulting to 'direto'", () => {
    const sessions = [
      makeSession({ utm_source: "google" }),
      makeSession({ utm_source: "google" }),
      makeSession({ utm_source: null }),
    ];
    const result = buildSourceBreakdown(sessions);
    expect(result.find(r => r.label === "google")?.count).toBe(2);
    expect(result.find(r => r.label === "direto")?.count).toBe(1);
  });
});

// ── buildReferrerBreakdown ────────────────────────────────────────────────────

describe("buildReferrerBreakdown()", () => {
  it("extracts hostname from referrer URL", () => {
    const sessions = [makeSession({ referrer: "https://google.com/search?q=test" })];
    const result   = buildReferrerBreakdown(sessions);
    expect(result[0].label).toBe("google.com");
  });

  it("returns 'direto' for sessions without referrer", () => {
    const sessions = [makeSession({ referrer: null })];
    const result   = buildReferrerBreakdown(sessions);
    expect(result[0].label).toBe("direto");
  });

  it("returns raw referrer if not a valid URL", () => {
    const sessions = [makeSession({ referrer: "not-a-url" })];
    const result   = buildReferrerBreakdown(sessions);
    expect(result[0].label).toBe("not-a-url");
  });
});

// ── computeStepMetrics ────────────────────────────────────────────────────────

describe("computeStepMetrics()", () => {
  it("counts views, completions, answerChanges for a given stepId", () => {
    const events = [
      makeEvent("step_view",      { step_id: "s1" }),
      makeEvent("step_view",      { step_id: "s1" }),
      makeEvent("step_completed", { step_id: "s1" }),
      makeEvent("answer_changed", { step_id: "s1" }),
      makeEvent("step_view",      { step_id: "s2" }), // different step — ignored
    ];
    const result = computeStepMetrics(events, "s1", {});
    expect(result.views).toBe(2);
    expect(result.completions).toBe(1);
    expect(result.answerChanges).toBe(1);
  });

  it("returns avgDurationSecs from the precomputed map", () => {
    const result = computeStepMetrics([], "s1", { s1: 42 });
    expect(result.avgDurationSecs).toBe(42);
  });

  it("returns 0 for avgDurationSecs when step not in map", () => {
    const result = computeStepMetrics([], "s1", {});
    expect(result.avgDurationSecs).toBe(0);
  });
});
