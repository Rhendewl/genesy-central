// ─────────────────────────────────────────────────────────────────────────────
// Analytics — Persistence Adapter
//
// Interface-first design: the AnalyticsConsumer knows only this interface.
// Swapping Supabase → IndexedDB → Redis requires zero changes in the consumer.
// ─────────────────────────────────────────────────────────────────────────────

import type { AnalyticsEventRecord, SessionUpdateInput } from "./types";

// ── Interface (contract) ─────────────────────────────────────────────────────

export interface AnalyticsPersistenceAdapter {
  /**
   * Persist a batch of analytics events.
   * Implementations must be idempotent: duplicate idempotency_keys are ignored.
   */
  saveBatch(
    slug:         string,
    token:        string,
    events:       AnalyticsEventRecord[],
  ): Promise<void>;

  /**
   * Update session metadata (device, UTM, timestamps, etc.).
   * Called once on session start and again on session end/abandon.
   */
  updateSession(
    slug:   string,
    token:  string,
    data:   SessionUpdateInput,
  ): Promise<void>;
}

// ── HTTP adapter (uses existing API routes) ───────────────────────────────────

/**
 * Production adapter — sends events to Next.js API routes which write to Supabase.
 * The consumer doesn't know about Supabase; it only calls this interface.
 */
/* v8 ignore start */
export class HttpPersistenceAdapter implements AnalyticsPersistenceAdapter {
  async saveBatch(
    slug:   string,
    token:  string,
    events: AnalyticsEventRecord[],
  ): Promise<void> {
    if (events.length === 0) return;

    const res = await fetch(`/api/form/${slug}/evento/batch`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ session_token: token, events }),
    });
    if (!res.ok) throw new Error(`analytics/batch: HTTP ${res.status}`);
  }

  async updateSession(
    slug:  string,
    token: string,
    data:  SessionUpdateInput,
  ): Promise<void> {
    const res = await fetch(`/api/form/${slug}/sessao`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ session_token: token, ...data }),
    });
    if (!res.ok) throw new Error(`analytics/session: HTTP ${res.status}`);
  }
}
/* v8 ignore stop */

// ── In-memory adapter (tests / SSR stubs) ────────────────────────────────────

export class InMemoryPersistenceAdapter implements AnalyticsPersistenceAdapter {
  readonly batches: Array<{ slug: string; token: string; events: AnalyticsEventRecord[] }> = [];
  readonly sessionUpdates: Array<{ slug: string; token: string; data: SessionUpdateInput }> = [];

  async saveBatch(slug: string, token: string, events: AnalyticsEventRecord[]): Promise<void> {
    this.batches.push({ slug, token, events });
  }

  async updateSession(slug: string, token: string, data: SessionUpdateInput): Promise<void> {
    this.sessionUpdates.push({ slug, token, data });
  }

  /** Utility for tests. */
  allEvents(): AnalyticsEventRecord[] {
    return this.batches.flatMap(b => b.events);
  }

  reset(): void {
    this.batches.length = 0;
    this.sessionUpdates.length = 0;
  }
}
