// ─────────────────────────────────────────────────────────────────────────────
// Analytics — InsightsDomain Builder
//
// Pure function: raw DB rows → structured InsightsDomain.
// The API route calls this; the Insights page consumes InsightsDomain.
// No side effects, no external calls.
// ─────────────────────────────────────────────────────────────────────────────

import type { InsightsDomain, RawInsightsData, FunnelStep, QuestionRankingItem } from "./types";
import {
  buildBreakdown,
  buildTimeSeries,
  buildSourceBreakdown,
  buildReferrerBreakdown,
  computeAvgDurationSeconds,
  computeAvgTimePerStep,
  computeAvgCompletionPct,
  computeConversionRate,
  computeAbandonmentRate,
  computeScoreDistribution,
  computeStepMetrics,
} from "./metrics";

export function buildInsightsDomain(
  data:        RawInsightsData,
  periodDays = 30,
): InsightsDomain {
  const { events, sessions, submissions, steps } = data;

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const views       = events.filter(e => e.event === "page_loaded").length;
  const starts      = events.filter(e => e.event === "session_started").length;
  const conversions = submissions.filter(s => s.status === "completed").length;

  const conversionRate  = computeConversionRate(starts, conversions);
  const abandonmentRate = computeAbandonmentRate(starts, conversions);

  // ── Time ──────────────────────────────────────────────────────────────────
  const avgTotalTimeSecs   = computeAvgDurationSeconds(sessions);
  const avgTimePerStepSecs = computeAvgTimePerStep(events);
  const avgCompletionPct   = computeAvgCompletionPct(sessions, steps.length);

  // ── Time series ───────────────────────────────────────────────────────────
  const viewEvents       = events.filter(e => e.event === "page_loaded");
  const startEvents      = events.filter(e => e.event === "session_started");
  const abandonEvents    = events.filter(e => e.event === "abandoned");
  const conversionEvents = submissions.filter(s => s.status === "completed");

  const series = {
    views:        buildTimeSeries(viewEvents,       periodDays),
    starts:       buildTimeSeries(startEvents,      periodDays),
    conversions:  buildTimeSeries(conversionEvents, periodDays),
    abandonments: buildTimeSeries(abandonEvents,    periodDays),
  };

  // ── Funnel & question ranking ─────────────────────────────────────────────
  const funnel: FunnelStep[]              = [];
  const questionRanking: QuestionRankingItem[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step    = steps[i];
    const metrics = computeStepMetrics(events, step.id, avgTimePerStepSecs);
    const dropCount = metrics.views - metrics.completions;
    const dropRate  = metrics.views > 0
      ? Math.round((dropCount / metrics.views) * 100)
      : 0;
    const completionRate = metrics.views > 0
      ? Math.round((metrics.completions / metrics.views) * 100)
      : 0;

    funnel.push({
      stepId:          step.id,
      stepTitle:       step.title,
      stepIndex:       i,
      views:           metrics.views,
      completions:     metrics.completions,
      completionRate,
      dropCount,
      dropRate,
      avgDurationSecs: metrics.avgDurationSecs,
    });

    questionRanking.push({
      stepId:          step.id,
      stepTitle:       step.title,
      views:           metrics.views,
      completions:     metrics.completions,
      dropRate,
      avgDurationSecs: metrics.avgDurationSecs,
      answerChanges:   metrics.answerChanges,
    });
  }

  // Sort question ranking by drop rate descending (most problematic first)
  questionRanking.sort((a, b) => b.dropRate - a.dropRate);

  // ── Devices ───────────────────────────────────────────────────────────────
  const devices  = buildBreakdown(sessions.map(s => s.device));
  const browsers = buildBreakdown(sessions.map(s => s.browser));
  const os       = buildBreakdown(sessions.map(s => s.os));

  // ── Traffic sources ───────────────────────────────────────────────────────
  const sources   = buildSourceBreakdown(sessions);
  const referrers = buildReferrerBreakdown(sessions);
  const utm = {
    sources:   buildBreakdown(sessions.map(s => s.utm_source),   "direto"),
    mediums:   buildBreakdown(sessions.map(s => s.utm_medium),   "nenhum"),
    campaigns: buildBreakdown(sessions.map(s => s.utm_campaign), "nenhuma"),
    terms:     buildBreakdown(sessions.map(s => s.utm_term),     "nenhum"),
    contents:  buildBreakdown(sessions.map(s => s.utm_content),  "nenhum"),
  };

  // ── Prepared — no data yet ────────────────────────────────────────────────
  const countries = buildBreakdown(sessions.map(s => s.country));
  const cities    = buildBreakdown(sessions.map(s => s.city));
  const languages = buildBreakdown(sessions.map(s => s.language));
  const scores    = computeScoreDistribution(submissions);

  return {
    views,
    starts,
    conversions,
    conversionRate,
    abandonmentRate,
    avgTotalTimeSecs,
    avgTimePerStepSecs,
    avgCompletionPct,
    series,
    funnel,
    questionRanking,
    devices,
    browsers,
    os,
    sources,
    referrers,
    utm,
    countries,
    cities,
    languages,
    scores,
    computedAt:  new Date().toISOString(),
    periodDays,
  };
}
