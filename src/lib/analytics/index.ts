export type {
  AnalyticsEventRecord,
  SessionUpdateInput,
  InsightsDomain,
  RawInsightsData,
  RawEventRow,
  RawSessionRow,
  RawSubmissionRow,
  RawStepDefinition,
  FunnelStep,
  QuestionRankingItem,
  BreakdownItem,
  TimeSeriesPoint,
  MetricSeries,
  UtmBreakdown,
  ScoreDistribution,
} from "./types";

export type {
  AnalyticsPersistenceAdapter,
} from "./persistence";

export { HttpPersistenceAdapter, InMemoryPersistenceAdapter } from "./persistence";
export { createAnalyticsConsumer }                            from "./consumer";
export type { AnalyticsConsumerConfig, AnalyticsConsumerInstance } from "./consumer";
export { buildInsightsDomain }                               from "./domain";
export {
  buildBreakdown,
  buildTimeSeries,
  buildTimeSeriesGrouped,
  computeConversionRate,
  computeAbandonmentRate,
  computeAvgDurationSeconds,
  computeAvgTimePerStep,
  computeAvgCompletionPct,
  computeScoreDistribution,
} from "./metrics";
export type { Granularity } from "./metrics";
export { collectDeviceInfo, collectUtmParams, detectBrowser, detectDevice, detectOS } from "./device";
export type { DeviceInfo, UtmParams } from "./device";
