// ─────────────────────────────────────────────────────────────────────────────
// Analytics — AnalyticsConsumer
//
// Receives FormBusEvents from the Event Bus and persists them via the
// AnalyticsPersistenceAdapter. Pure TypeScript — no React, no Renderer,
// no Runtime, no Logic Engine dependencies.
//
// Features:
//   - Batching (flush every N events or every flushIntervalMs)
//   - Deduplication by event.id (idempotency_key)
//   - Session metadata enrichment (device, browser, OS, UTM) on session start
//   - Immediate flush on terminal events (form.completed, form.abandoned, etc.)
//   - Graceful degradation: errors in persistence do not break the bus
// ─────────────────────────────────────────────────────────────────────────────

import type { BusEvent, EventConsumer } from "../event-bus/types";
import { ConsumerPriority } from "../event-bus/types";
import { FORM_DB_EVENT_MAP, type FormEventType, type FormEventPayloads } from "../event-bus/form/types";
import type { AnalyticsPersistenceAdapter } from "./persistence";
import type { AnalyticsEventRecord, SessionUpdateInput } from "./types";
import { collectDeviceInfo, collectUtmParams } from "./device";

// ── Terminal events trigger immediate flush ────────────────────────────────────

const TERMINAL_EVENTS = new Set<FormEventType>([
  "form.completed",
  "form.abandoned",
  "form.session.timeout",
  "form.submission.succeeded",
]);

// ── Session events trigger metadata collection ────────────────────────────────

const SESSION_START_EVENTS = new Set<FormEventType>([
  "form.started",
  "form.loaded",
]);

const SESSION_END_EVENTS = new Set<FormEventType>([
  "form.completed",
  "form.abandoned",
  "form.session.timeout",
  "form.submission.succeeded",
]);

// ── Config ────────────────────────────────────────────────────────────────────

export interface AnalyticsConsumerConfig {
  readonly slug:            string;
  readonly getToken:        () => string | null;
  readonly adapter:         AnalyticsPersistenceAdapter;
  /** Max events before triggering a flush. Default: 10. */
  readonly batchSize?:      number;
  /** Milliseconds between periodic flushes. Default: 4000. */
  readonly flushIntervalMs?: number;
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createAnalyticsConsumer(config: AnalyticsConsumerConfig): EventConsumer {
  const {
    slug,
    getToken,
    adapter,
    batchSize      = 10,
    flushIntervalMs = 4000,
  } = config;

  // ── Internal state ──────────────────────────────────────────────────────────
  const buffer:   AnalyticsEventRecord[] = [];
  const seen      = new Set<string>(); // dedup by idempotency_key
  let   timer:    ReturnType<typeof setTimeout> | null = null;

  // ── Flush buffer to persistence ─────────────────────────────────────────────
  async function flush(): Promise<void> {
    if (timer !== null) { clearTimeout(timer); timer = null; }
    if (buffer.length === 0) return;

    const token = getToken();
    if (!token) { buffer.length = 0; return; }

    const batch = buffer.splice(0, buffer.length);
    try {
      await adapter.saveBatch(slug, token, batch);
    } catch {
      // Re-insert at the front so events aren't lost on transient failures
      buffer.unshift(...batch);
    }
  }

  // ── Schedule periodic flush ─────────────────────────────────────────────────
  function scheduleFlush(): void {
    if (timer !== null) return;
    timer = setTimeout(() => { timer = null; flush().catch(() => {}); }, flushIntervalMs);
  }

  // ── Enqueue one event ──────────────────────────────────────────────────────
  function enqueue(record: AnalyticsEventRecord): void {
    if (seen.has(record.idempotency_key)) return; // deduplicate
    seen.add(record.idempotency_key);
    buffer.push(record);
  }

  // ── Build meta from payload ─────────────────────────────────────────────────
  function buildMeta(
    eventType: FormEventType,
    payload:   Partial<Record<string, unknown>>,
  ): Record<string, unknown> | undefined {
    const meta: Record<string, unknown> = {};
    const include = (key: string) => {
      const val = payload[key];
      if (val !== undefined && val !== null) meta[key] = val;
    };
    include("stepIndex"); include("stepType"); include("fromStepId");
    include("toStepId"); include("toStepIndex"); include("ruleId");
    include("actionType"); include("endingId"); include("url");
    include("reason"); include("context"); include("attempt");
    include("errorCode"); include("rulesChecked"); include("answersCount");
    include("totalSteps"); include("lastStepIndex"); include("submissionId");
    if (eventType === "form.rule.matched" || eventType === "form.rule.not_matched") {
      include("rulesChecked");
    }
    return Object.keys(meta).length > 0 ? meta : undefined;
  }

  // ── Handle session metadata collection ─────────────────────────────────────
  async function handleSessionMetadata(
    eventType: FormEventType,
    _payload:  Partial<Record<string, unknown>>,
  ): Promise<void> {
    const token = getToken();
    if (!token) return;

    if (SESSION_START_EVENTS.has(eventType)) {
      const device = collectDeviceInfo();
      const utm    = collectUtmParams();
      const update: SessionUpdateInput = { ...device, ...utm };
      adapter.updateSession(slug, token, update).catch(() => {});
    }

    if (SESSION_END_EVENTS.has(eventType)) {
      const update: SessionUpdateInput = {
        finished_at: new Date().toISOString(),
        is_partial:  eventType !== "form.completed" && eventType !== "form.submission.succeeded",
      };
      adapter.updateSession(slug, token, update).catch(() => {});
    }

    if (eventType === "form.abandoned" || eventType === "form.session.timeout") {
      const update: SessionUpdateInput = { abandoned_at: new Date().toISOString() };
      adapter.updateSession(slug, token, update).catch(() => {});
    }
  }

  // ── Main handle ─────────────────────────────────────────────────────────────
  async function handle(event: BusEvent): Promise<void> {
    const eventType = event.type as FormEventType;
    const dbName    = FORM_DB_EVENT_MAP[eventType];
    if (!dbName) return; // unmapped — not persisted

    const token = getToken();
    if (!token) return;

    const payload = (event.payload ?? {}) as Partial<FormEventPayloads[FormEventType]>;
    const raw     = payload as Partial<Record<string, unknown>>;

    const record: AnalyticsEventRecord = {
      idempotency_key: event.id,
      event:           dbName,
      step_id:         typeof raw.stepId === "string" ? raw.stepId : undefined,
      duration:        typeof raw.durationSeconds === "number" ? raw.durationSeconds : undefined,
      meta:            buildMeta(eventType, raw),
    };

    enqueue(record);

    // Handle session metadata side effects (fire-and-forget)
    handleSessionMetadata(eventType, raw).catch(() => {});

    // Flush immediately on terminal events; otherwise schedule periodic flush
    if (TERMINAL_EVENTS.has(eventType)) {
      await flush();
    } else {
      if (buffer.length >= batchSize) {
        await flush();
      } else {
        scheduleFlush();
      }
    }
  }

  // ── Cleanup on destroy ──────────────────────────────────────────────────────
  function destroy(): void {
    if (timer !== null) { clearTimeout(timer); timer = null; }
    buffer.length = 0;
    seen.clear();
  }

  // ── All tracked events (those with a DB mapping) ────────────────────────────
  const trackedEvents = Object.keys(FORM_DB_EVENT_MAP) as string[];

  return {
    name:     "analytics",
    priority: ConsumerPriority.HIGH,
    events:   trackedEvents,
    handle,
    retry:    { maxAttempts: 2, backoffMs: 500, persist: false },
    // Expose internal controls for the hook lifecycle
    ...(({ destroy }) => ({ _destroy: destroy }))(({ destroy })),
  } as EventConsumer & { _destroy: () => void };
}

// ── Type helper so callers can access _destroy ─────────────────────────────────

export type AnalyticsConsumerInstance =
  EventConsumer & { _destroy: () => void };
