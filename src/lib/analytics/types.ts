// ─────────────────────────────────────────────────────────────────────────────
// Analytics — Domain Types
//
// Pure TypeScript. No React, no Supabase client, no browser APIs.
// These types define the contract between:
//   - the AnalyticsConsumer (producer)
//   - the PersistenceAdapter (storage)
//   - the InsightsDomain (aggregated view for the Insights page)
// ─────────────────────────────────────────────────────────────────────────────

// ── Raw records (what gets persisted) ────────────────────────────────────────

/** Single analytics event to be stored in form_events. */
export interface AnalyticsEventRecord {
  /** The bus-generated event ID — used as idempotency_key. */
  readonly idempotency_key: string;
  /** DB event name (from FORM_DB_EVENT_MAP). */
  readonly event:           string;
  /** Optional step reference. */
  readonly step_id?:        string;
  /** Step duration in seconds (for step_completed events). */
  readonly duration?:       number;
  /** Arbitrary context that doesn't have a dedicated column. */
  readonly meta?:           Record<string, unknown>;
}

/** Data used to update or enrich a session record on session start/end. */
export interface SessionUpdateInput {
  readonly device?:        string;
  readonly browser?:       string;
  readonly os?:            string;
  readonly language?:      string;
  readonly country?:       string;   // populated by geo (future)
  readonly city?:          string;   // populated by geo (future)
  readonly utm_source?:    string;
  readonly utm_medium?:    string;
  readonly utm_campaign?:  string;
  readonly utm_term?:      string;
  readonly utm_content?:   string;
  readonly referrer?:      string;
  readonly finished_at?:   string;   // ISO string
  readonly abandoned_at?:  string;   // ISO string
  readonly is_partial?:    boolean;
  readonly steps_completed?: number;
}

// ── Breakdown / time series primitives ───────────────────────────────────────

export interface BreakdownItem {
  readonly label: string;
  readonly count: number;
  readonly percentage: number;
}

export interface TimeSeriesPoint {
  readonly date:  string;        // YYYY-MM-DD
  readonly value: number;
}

// ── Funnel ────────────────────────────────────────────────────────────────────

export interface FunnelStep {
  readonly stepId:          string;
  readonly stepTitle:       string;
  readonly stepIndex:       number;
  readonly views:           number;
  readonly completions:     number;
  readonly completionRate:  number;   // % (0–100)
  readonly dropCount:       number;
  readonly dropRate:        number;   // % (0–100)
  readonly avgDurationSecs: number;
}

// ── Question ranking ──────────────────────────────────────────────────────────

export interface QuestionRankingItem {
  readonly stepId:          string;
  readonly stepTitle:       string;
  readonly views:           number;
  readonly completions:     number;
  readonly dropRate:        number;   // % (0–100)
  readonly avgDurationSecs: number;
  readonly answerChanges:   number;   // how many times users changed their answer
}

// ── Score distribution ────────────────────────────────────────────────────────

export interface ScoreDistribution {
  readonly min:    number;
  readonly max:    number;
  readonly avg:    number;
  readonly median: number;
  readonly buckets: Array<{ range: string; count: number }>;
}

// ── UTM breakdown ─────────────────────────────────────────────────────────────

export interface UtmBreakdown {
  readonly sources:   BreakdownItem[];
  readonly mediums:   BreakdownItem[];
  readonly campaigns: BreakdownItem[];
  readonly terms:     BreakdownItem[];
  readonly contents:  BreakdownItem[];
}

// ── Time series set ───────────────────────────────────────────────────────────

export interface MetricSeries {
  readonly views:       TimeSeriesPoint[];
  readonly starts:      TimeSeriesPoint[];
  readonly conversions: TimeSeriesPoint[];
  readonly abandonments: TimeSeriesPoint[];
}

// ── Full Insights Domain ──────────────────────────────────────────────────────

/**
 * Complete aggregated model for the Insights page.
 * Computed from form_events + form_sessions + form_submissions.
 * All fields are populated — arrays are empty when there's no data yet.
 */
export interface InsightsDomain {
  // ── KPIs ──────────────────────────────────────────────────────────────────
  readonly views:            number;
  readonly starts:           number;
  readonly conversions:      number;
  readonly conversionRate:   number;     // % (0–100)
  readonly abandonmentRate:  number;     // % (0–100)

  // ── Time ──────────────────────────────────────────────────────────────────
  readonly avgTotalTimeSecs:    number;
  readonly avgTimePerStepSecs:  Record<string, number>;  // stepId → avg secs
  readonly avgCompletionPct:    number;                  // avg % of steps completed

  // ── Time series (daily, last 30 days) ────────────────────────────────────
  readonly series: MetricSeries;

  // ── Funnel & drop-off ─────────────────────────────────────────────────────
  readonly funnel:           FunnelStep[];
  readonly questionRanking:  QuestionRankingItem[];

  // ── Devices ───────────────────────────────────────────────────────────────
  readonly devices:   BreakdownItem[];
  readonly browsers:  BreakdownItem[];
  readonly os:        BreakdownItem[];

  // ── Traffic sources ───────────────────────────────────────────────────────
  readonly sources:   BreakdownItem[];    // utm_source or "direct"
  readonly referrers: BreakdownItem[];
  readonly utm:       UtmBreakdown;

  // ── Prepared — no data in this phase ─────────────────────────────────────
  readonly countries:  BreakdownItem[];   // awaiting geo implementation
  readonly cities:     BreakdownItem[];   // awaiting geo implementation
  readonly languages:  BreakdownItem[];
  readonly scores:     ScoreDistribution | null;

  // ── Metadata ──────────────────────────────────────────────────────────────
  readonly computedAt:  string;    // ISO timestamp of computation
  readonly periodDays:  number;    // number of days the data covers
}

// ── Raw data inputs for domain builder ───────────────────────────────────────

export interface RawEventRow {
  readonly event:      string;
  readonly step_id:    string | null;
  readonly duration:   number | null;
  readonly meta:       Record<string, unknown> | null;
  readonly created_at: string;
}

export interface RawSessionRow {
  readonly device:        string | null;
  readonly browser:       string | null;
  readonly os:            string | null;
  readonly language:      string | null;
  readonly country:       string | null;
  readonly city:          string | null;
  readonly utm_source:    string | null;
  readonly utm_medium:    string | null;
  readonly utm_campaign:  string | null;
  readonly utm_term:      string | null;
  readonly utm_content:   string | null;
  readonly referrer:      string | null;
  readonly steps_completed: number;
  readonly is_partial:    boolean;
  readonly started_at:    string;
  readonly finished_at:   string | null;
  readonly abandoned_at:  string | null;
}

export interface RawSubmissionRow {
  readonly status:       string;
  readonly score:        number | null;
  readonly created_at:   string;
}

export interface RawStepDefinition {
  readonly id:    string;
  readonly title: string;
  readonly type?: string;
}

export interface RawInsightsData {
  readonly events:      RawEventRow[];
  readonly sessions:    RawSessionRow[];
  readonly submissions: RawSubmissionRow[];
  readonly steps:       RawStepDefinition[];
}
