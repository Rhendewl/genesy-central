import { describe, it, expect } from "vitest";
import { buildInsightsDomain } from "../domain";
import type { RawInsightsData } from "../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STEPS = [
  { id: "s1", title: "Nome",  type: "text"   },
  { id: "s2", title: "Email", type: "email"  },
  { id: "s3", title: "Cargo", type: "choice" },
];

function makeData(overrides: Partial<RawInsightsData> = {}): RawInsightsData {
  return {
    events:      [],
    sessions:    [],
    submissions: [],
    steps:       STEPS,
    ...overrides,
  };
}

// ── Empty data ────────────────────────────────────────────────────────────────

describe("buildInsightsDomain() — empty data", () => {
  it("returns zero KPIs for empty data", () => {
    const domain = buildInsightsDomain(makeData());
    expect(domain.views).toBe(0);
    expect(domain.starts).toBe(0);
    expect(domain.conversions).toBe(0);
    expect(domain.conversionRate).toBe(0);
    expect(domain.abandonmentRate).toBe(0);
  });

  it("returns empty funnel matching step count", () => {
    const domain = buildInsightsDomain(makeData());
    expect(domain.funnel).toHaveLength(3);
    expect(domain.funnel[0].stepId).toBe("s1");
  });

  it("returns empty time series", () => {
    const domain = buildInsightsDomain(makeData());
    expect(domain.series.views).toHaveLength(0);
    expect(domain.series.starts).toHaveLength(0);
    expect(domain.series.conversions).toHaveLength(0);
    expect(domain.series.abandonments).toHaveLength(0);
  });

  it("returns empty device/browser/os breakdowns", () => {
    const domain = buildInsightsDomain(makeData());
    expect(domain.devices).toHaveLength(0);
    expect(domain.browsers).toHaveLength(0);
    expect(domain.os).toHaveLength(0);
  });

  it("returns null for scores when no submissions have scores", () => {
    const domain = buildInsightsDomain(makeData());
    expect(domain.scores).toBeNull();
  });

  it("includes computedAt and periodDays metadata", () => {
    const domain = buildInsightsDomain(makeData(), 14);
    expect(typeof domain.computedAt).toBe("string");
    expect(domain.periodDays).toBe(14);
  });
});

// ── KPI calculation ───────────────────────────────────────────────────────────

describe("buildInsightsDomain() — KPIs", () => {
  it("counts page_loaded events as views", () => {
    const domain = buildInsightsDomain(makeData({
      events: [
        { event: "page_loaded", step_id: null, duration: null, meta: null, created_at: "2026-06-01T10:00:00Z" },
        { event: "page_loaded", step_id: null, duration: null, meta: null, created_at: "2026-06-02T10:00:00Z" },
        { event: "session_started", step_id: null, duration: null, meta: null, created_at: "2026-06-01T10:00:00Z" },
      ],
    }));
    expect(domain.views).toBe(2);
  });

  it("counts session_started events as starts", () => {
    const domain = buildInsightsDomain(makeData({
      events: [
        { event: "session_started", step_id: null, duration: null, meta: null, created_at: "2026-06-01T10:00:00Z" },
        { event: "session_started", step_id: null, duration: null, meta: null, created_at: "2026-06-02T10:00:00Z" },
      ],
    }));
    expect(domain.starts).toBe(2);
  });

  it("counts completed submissions as conversions", () => {
    const domain = buildInsightsDomain(makeData({
      submissions: [
        { status: "completed", score: null, created_at: "2026-06-01T10:00:00Z" },
        { status: "partial",   score: null, created_at: "2026-06-01T10:00:00Z" },
      ],
    }));
    expect(domain.conversions).toBe(1);
  });

  it("computes conversion rate as conversions/starts × 100", () => {
    const domain = buildInsightsDomain(makeData({
      events: [
        { event: "session_started", step_id: null, duration: null, meta: null, created_at: "2026-06-01T10:00:00Z" },
        { event: "session_started", step_id: null, duration: null, meta: null, created_at: "2026-06-01T11:00:00Z" },
        { event: "session_started", step_id: null, duration: null, meta: null, created_at: "2026-06-01T12:00:00Z" },
        { event: "session_started", step_id: null, duration: null, meta: null, created_at: "2026-06-01T13:00:00Z" },
      ],
      submissions: [
        { status: "completed", score: null, created_at: "2026-06-01T10:00:00Z" },
      ],
    }));
    expect(domain.conversionRate).toBe(25);
    expect(domain.abandonmentRate).toBe(75);
  });
});

// ── Funnel ────────────────────────────────────────────────────────────────────

describe("buildInsightsDomain() — funnel", () => {
  it("computes step views, completions, and drop rate", () => {
    const domain = buildInsightsDomain(makeData({
      events: [
        { event: "step_view",      step_id: "s1", duration: null, meta: null, created_at: "2026-06-01T10:00:00Z" },
        { event: "step_view",      step_id: "s1", duration: null, meta: null, created_at: "2026-06-01T10:01:00Z" },
        { event: "step_completed", step_id: "s1", duration: 30,   meta: null, created_at: "2026-06-01T10:02:00Z" },
      ],
    }));
    const s1 = domain.funnel.find(f => f.stepId === "s1")!;
    expect(s1.views).toBe(2);
    expect(s1.completions).toBe(1);
    expect(s1.dropCount).toBe(1);
    expect(s1.dropRate).toBe(50);
    expect(s1.completionRate).toBe(50);
  });

  it("includes stepIndex matching the step position in the definition", () => {
    const domain = buildInsightsDomain(makeData());
    expect(domain.funnel[0].stepIndex).toBe(0);
    expect(domain.funnel[1].stepIndex).toBe(1);
    expect(domain.funnel[2].stepIndex).toBe(2);
  });

  it("includes avgDurationSecs for completed steps", () => {
    const domain = buildInsightsDomain(makeData({
      events: [
        { event: "step_completed", step_id: "s2", duration: 60, meta: null, created_at: "2026-06-01T10:00:00Z" },
        { event: "step_completed", step_id: "s2", duration: 40, meta: null, created_at: "2026-06-01T11:00:00Z" },
      ],
    }));
    const s2 = domain.funnel.find(f => f.stepId === "s2")!;
    expect(s2.avgDurationSecs).toBe(50);
  });
});

// ── Question ranking ──────────────────────────────────────────────────────────

describe("buildInsightsDomain() — question ranking", () => {
  it("sorts by drop rate descending (most problematic first)", () => {
    const domain = buildInsightsDomain(makeData({
      events: [
        // s2: 10 views, 1 completion → 90% drop
        ...Array.from({ length: 10 }, (_, i) => ({
          event: "step_view", step_id: "s2", duration: null, meta: null,
          created_at: `2026-06-01T10:0${i}:00Z`,
        })),
        { event: "step_completed", step_id: "s2", duration: 10, meta: null, created_at: "2026-06-01T10:10:00Z" },
        // s1: 2 views, 2 completions → 0% drop
        { event: "step_view",      step_id: "s1", duration: null, meta: null, created_at: "2026-06-01T10:00:00Z" },
        { event: "step_view",      step_id: "s1", duration: null, meta: null, created_at: "2026-06-01T10:01:00Z" },
        { event: "step_completed", step_id: "s1", duration: 5,   meta: null, created_at: "2026-06-01T10:02:00Z" },
        { event: "step_completed", step_id: "s1", duration: 5,   meta: null, created_at: "2026-06-01T10:03:00Z" },
      ],
    }));
    expect(domain.questionRanking[0].stepId).toBe("s2");
    expect(domain.questionRanking[0].dropRate).toBeGreaterThan(0);
  });

  it("includes answerChanges count per step", () => {
    const domain = buildInsightsDomain(makeData({
      events: [
        { event: "answer_changed", step_id: "s1", duration: null, meta: null, created_at: "2026-06-01T10:00:00Z" },
        { event: "answer_changed", step_id: "s1", duration: null, meta: null, created_at: "2026-06-01T10:01:00Z" },
        { event: "answer_changed", step_id: "s1", duration: null, meta: null, created_at: "2026-06-01T10:02:00Z" },
      ],
    }));
    const s1 = domain.questionRanking.find(q => q.stepId === "s1")!;
    expect(s1.answerChanges).toBe(3);
  });
});

// ── Time series ───────────────────────────────────────────────────────────────

describe("buildInsightsDomain() — time series", () => {
  it("builds views series from page_loaded events", () => {
    const domain = buildInsightsDomain(makeData({
      events: [
        { event: "page_loaded", step_id: null, duration: null, meta: null, created_at: "2026-06-01T10:00:00Z" },
        { event: "page_loaded", step_id: null, duration: null, meta: null, created_at: "2026-06-01T14:00:00Z" },
        { event: "page_loaded", step_id: null, duration: null, meta: null, created_at: "2026-06-02T10:00:00Z" },
      ],
    }));
    const june1 = domain.series.views.find(p => p.date === "2026-06-01")!;
    expect(june1.value).toBe(2);
    expect(domain.series.views.find(p => p.date === "2026-06-02")?.value).toBe(1);
  });

  it("builds abandonments series from abandoned events", () => {
    const domain = buildInsightsDomain(makeData({
      events: [
        { event: "abandoned", step_id: null, duration: null, meta: null, created_at: "2026-06-01T10:00:00Z" },
      ],
    }));
    expect(domain.series.abandonments).toHaveLength(1);
    expect(domain.series.abandonments[0].value).toBe(1);
  });
});

// ── Device / source breakdowns ────────────────────────────────────────────────

describe("buildInsightsDomain() — breakdowns", () => {
  const sessions = [
    {
      device: "mobile", browser: "Safari", os: "iOS", language: "pt",
      country: "BR", city: null, utm_source: "instagram", utm_medium: "social",
      utm_campaign: "summer", utm_term: null, utm_content: null,
      referrer: "https://instagram.com/", steps_completed: 3,
      is_partial: false, started_at: "2026-06-01T10:00:00Z",
      finished_at: "2026-06-01T10:05:00Z", abandoned_at: null,
    },
    {
      device: "desktop", browser: "Chrome", os: "macOS", language: "en",
      country: null, city: null, utm_source: "google", utm_medium: "cpc",
      utm_campaign: null, utm_term: null, utm_content: null,
      referrer: null, steps_completed: 2,
      is_partial: true, started_at: "2026-06-01T11:00:00Z",
      finished_at: null, abandoned_at: "2026-06-01T11:03:00Z",
    },
  ];

  it("breaks down by device", () => {
    const domain = buildInsightsDomain(makeData({ sessions }));
    expect(domain.devices.find(d => d.label === "mobile")?.count).toBe(1);
    expect(domain.devices.find(d => d.label === "desktop")?.count).toBe(1);
  });

  it("breaks down by browser", () => {
    const domain = buildInsightsDomain(makeData({ sessions }));
    expect(domain.browsers.map(b => b.label)).toContain("Safari");
    expect(domain.browsers.map(b => b.label)).toContain("Chrome");
  });

  it("breaks down UTM sources", () => {
    const domain = buildInsightsDomain(makeData({ sessions }));
    expect(domain.utm.sources.find(s => s.label === "instagram")?.count).toBe(1);
    expect(domain.utm.sources.find(s => s.label === "google")?.count).toBe(1);
  });

  it("computes language breakdown", () => {
    const domain = buildInsightsDomain(makeData({ sessions }));
    expect(domain.languages.find(l => l.label === "pt")?.count).toBe(1);
  });

  it("populates countries from session data (prepared for geo)", () => {
    const domain = buildInsightsDomain(makeData({ sessions }));
    const brazil = domain.countries.find(c => c.label === "BR");
    expect(brazil?.count).toBe(1);
  });
});

// ── Scores ────────────────────────────────────────────────────────────────────

describe("buildInsightsDomain() — scores", () => {
  it("computes score distribution when submissions have scores", () => {
    const domain = buildInsightsDomain(makeData({
      submissions: [
        { status: "completed", score: 10, created_at: "2026-06-01T10:00:00Z" },
        { status: "completed", score: 80, created_at: "2026-06-01T10:00:00Z" },
        { status: "completed", score: 50, created_at: "2026-06-01T10:00:00Z" },
      ],
    }));
    expect(domain.scores).not.toBeNull();
    expect(domain.scores!.min).toBe(10);
    expect(domain.scores!.max).toBe(80);
    expect(domain.scores!.buckets).toHaveLength(5);
  });
});

// ── Avg completion ────────────────────────────────────────────────────────────

describe("buildInsightsDomain() — avg completion", () => {
  it("computes average % of steps completed per session", () => {
    const domain = buildInsightsDomain(makeData({
      sessions: [
        {
          device: null, browser: null, os: null, language: null,
          country: null, city: null, utm_source: null, utm_medium: null,
          utm_campaign: null, utm_term: null, utm_content: null,
          referrer: null, steps_completed: 3, is_partial: false,
          started_at: "2026-06-01T10:00:00Z", finished_at: "2026-06-01T10:05:00Z", abandoned_at: null,
        },
        {
          device: null, browser: null, os: null, language: null,
          country: null, city: null, utm_source: null, utm_medium: null,
          utm_campaign: null, utm_term: null, utm_content: null,
          referrer: null, steps_completed: 0, is_partial: true,
          started_at: "2026-06-01T11:00:00Z", finished_at: null, abandoned_at: null,
        },
      ],
    }));
    // (3/3 + 0/3) / 2 = 50%
    expect(domain.avgCompletionPct).toBe(50);
  });
});
