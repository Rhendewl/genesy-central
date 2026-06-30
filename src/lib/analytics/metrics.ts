// ─────────────────────────────────────────────────────────────────────────────
// Analytics — Pure Metric Computation Functions
//
// All functions are pure: same inputs → same outputs, no side effects.
// Designed to run on both client and server (API route or edge function).
// ─────────────────────────────────────────────────────────────────────────────

import type {
  BreakdownItem,
  TimeSeriesPoint,
  RawEventRow,
  RawSessionRow,
  RawSubmissionRow,
  ScoreDistribution,
} from "./types";

export type Granularity = "hour" | "day" | "week" | "month";

function groupKey(iso: string, g: Granularity): string {
  if (g === "hour")  return iso.slice(0, 13);      // "2024-01-15T14"
  if (g === "day")   return iso.slice(0, 10);      // "2024-01-15"
  if (g === "month") return iso.slice(0, 7);       // "2024-01"
  // week: ISO week key "YYYY-Www"
  const d   = new Date(iso);
  const thu = new Date(d); thu.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3);
  const y   = thu.getFullYear();
  const jan4 = new Date(y, 0, 4);
  const w   = 1 + Math.round((thu.getTime() - jan4.getTime()) / 604_800_000);
  return `${y}-W${String(w).padStart(2, "0")}`;
}

export function buildTimeSeriesGrouped(
  rows: ReadonlyArray<{ created_at: string }>,
  granularity: Granularity = "day",
): TimeSeriesPoint[] {
  const counts: Record<string, number> = {};
  for (let i = 0; i < rows.length; i++) {
    const key = groupKey(rows[i].created_at, granularity);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── Breakdown helpers ─────────────────────────────────────────────────────────

/** Counts occurrences of each key in an array of nullable strings. */
export function buildBreakdown(
  values: ReadonlyArray<string | null | undefined>,
  fallback = "Desconhecido",
): BreakdownItem[] {
  const total = values.length;
  if (total === 0) return [];

  const counts: Record<string, number> = {};
  for (let i = 0; i < values.length; i++) {
    const key = values[i] ?? fallback;
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return Object.entries(counts)
    .map(([label, count]) => ({
      label,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

// ── Time series ───────────────────────────────────────────────────────────────

/** Groups event rows by date (YYYY-MM-DD) and counts them. Returns last `days` days. */
export function buildTimeSeries(
  rows:      ReadonlyArray<{ created_at: string }>,
  days = 30,
): TimeSeriesPoint[] {
  const counts: Record<string, number> = {};
  for (let i = 0; i < rows.length; i++) {
    const day = rows[i].created_at.slice(0, 10);
    counts[day] = (counts[day] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-days);
}

// ── Session duration ──────────────────────────────────────────────────────────

// Sessions longer than this are excluded — user almost certainly left the tab open.
const MAX_SESSION_MS = 30 * 60 * 1000; // 30 minutes

/** Returns the average duration (seconds) of completed sessions, excluding outliers > 30 min. */
export function computeAvgDurationSeconds(sessions: ReadonlyArray<RawSessionRow>): number {
  const durations = sessions
    .filter(s => s.finished_at !== null && s.started_at !== null)
    .map(s => new Date(s.finished_at!).getTime() - new Date(s.started_at).getTime())
    .filter(ms => ms > 0 && ms <= MAX_SESSION_MS);

  if (durations.length === 0) return 0;
  const total = durations.reduce((a, b) => a + b, 0);
  return Math.round(total / durations.length / 1000);
}

// ── Step duration ─────────────────────────────────────────────────────────────

/** Averages step durations from step_completed events. Returns a map of stepId → avg secs. */
export function computeAvgTimePerStep(events: ReadonlyArray<RawEventRow>): Record<string, number> {
  const buckets: Record<string, number[]> = {};
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.event === "step_completed" && e.step_id && e.duration != null) {
      (buckets[e.step_id] ??= []).push(e.duration);
    }
  }
  const result: Record<string, number> = {};
  const keys = Object.keys(buckets);
  for (let i = 0; i < keys.length; i++) {
    const stepId = keys[i];
    const vals   = buckets[stepId];
    const sum    = vals.reduce((a, b) => a + b, 0);
    result[stepId] = Math.round(sum / vals.length);
  }
  return result;
}

// ── Completion percentage ─────────────────────────────────────────────────────

/** Average % of steps completed per session. */
export function computeAvgCompletionPct(
  sessions:   ReadonlyArray<RawSessionRow>,
  totalSteps: number,
): number {
  if (totalSteps === 0 || sessions.length === 0) return 0;
  const sum = sessions.reduce((acc, s) => acc + s.steps_completed, 0);
  const avg = sum / sessions.length;
  return Math.round((avg / totalSteps) * 100);
}

// ── Conversion / abandonment ──────────────────────────────────────────────────

export function computeConversionRate(starts: number, conversions: number): number {
  return starts > 0 ? Math.round((conversions / starts) * 100) : 0;
}

export function computeAbandonmentRate(starts: number, conversions: number): number {
  return starts > 0 ? Math.round(((starts - conversions) / starts) * 100) : 0;
}

// ── Score distribution ────────────────────────────────────────────────────────

export function computeScoreDistribution(
  submissions: ReadonlyArray<RawSubmissionRow>,
): ScoreDistribution | null {
  const scores = submissions
    .map(s => s.score)
    .filter((s): s is number => s !== null);

  if (scores.length === 0) return null;

  scores.sort((a, b) => a - b);
  const min    = scores[0];
  const max    = scores[scores.length - 1];
  const sum    = scores.reduce((a, b) => a + b, 0);
  const avg    = Math.round(sum / scores.length);
  const midIdx = Math.floor(scores.length / 2);
  const median = scores.length % 2 === 0
    ? Math.round((scores[midIdx - 1] + scores[midIdx]) / 2)
    : scores[midIdx];

  // Build 5 equal-width buckets between min and max
  const buckets: Array<{ range: string; count: number }> = [];
  const range   = max - min;
  const width   = range > 0 ? Math.ceil(range / 5) : 1;
  for (let i = 0; i < 5; i++) {
    const lo    = min + i * width;
    const hi    = lo + width - 1;
    const count = scores.filter(s => s >= lo && s <= hi).length;
    buckets.push({ range: `${lo}–${hi}`, count });
  }

  return { min, max, avg, median, buckets };
}

// ── UTM / source breakdown ────────────────────────────────────────────────────

export function buildSourceBreakdown(sessions: ReadonlyArray<RawSessionRow>): BreakdownItem[] {
  const values = sessions.map(s => s.utm_source ?? "direto");
  return buildBreakdown(values);
}

export function buildReferrerBreakdown(sessions: ReadonlyArray<RawSessionRow>): BreakdownItem[] {
  const values = sessions.map(s => {
    if (!s.referrer) return "direto";
    try {
      return new URL(s.referrer).hostname;
    } catch {
      return s.referrer;
    }
  });
  return buildBreakdown(values);
}

// ── Funnel step computation ───────────────────────────────────────────────────

export function computeStepMetrics(
  events:  ReadonlyArray<RawEventRow>,
  stepId:  string,
  avgTime: Record<string, number>,
): { views: number; completions: number; answerChanges: number; avgDurationSecs: number } {
  let views = 0;
  let completions = 0;
  let answerChanges = 0;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.step_id !== stepId) continue;
    if (e.event === "step_view")      views++;
    if (e.event === "step_completed") completions++;
    if (e.event === "answer_changed") answerChanges++;
  }
  return {
    views,
    completions,
    answerChanges,
    avgDurationSecs: avgTime[stepId] ?? 0,
  };
}
