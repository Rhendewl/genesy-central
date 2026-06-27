// ─────────────────────────────────────────────────────────────────────────────
// Integrations Layer — Core Types
//
// Pure TypeScript. Zero deps on React, Supabase, or browser APIs.
// Every component in the integration layer shares these contracts.
// ─────────────────────────────────────────────────────────────────────────────

// ── Integration Event (normalized from BusEvent) ────────────────────────────

export interface IntegrationEvent {
  /** Bus event.id — primary idempotency key. */
  readonly id:            string;
  /** Propagated correlationId — tracks the full journey to external providers. */
  readonly correlationId: string;
  readonly type:          string;
  readonly formSlug:      string;
  readonly sessionToken:  string;
  readonly timestamp:     number;
  readonly payload:       Record<string, unknown>;
  readonly meta:          Record<string, unknown>;
  /** Pipeline version stamp. Incremented on schema breaks. */
  readonly version:       number;
}

/** Event after the Transform Pipeline has been applied. */
export interface TransformedEvent extends IntegrationEvent {
  readonly transformed: true;
  readonly transforms:  string[];   // names of applied transforms, in order
}

// ── Delivery context ─────────────────────────────────────────────────────────

export interface IntegrationContext {
  /** Deterministic: hash(eventId + configId) — idempotency per integration. */
  readonly deliveryId:    string;
  /** Propagated from bus correlationId. */
  readonly correlationId: string;
  readonly attempt:       number;
  readonly maxAttempts:   number;
  readonly timeoutMs:     number;
  readonly signal:        AbortSignal;
}

// ── Adapter capabilities ──────────────────────────────────────────────────────

export interface AdapterCapabilities {
  readonly supportsBatch:  boolean;
  readonly supportsRetry:  boolean;
  readonly supportsOAuth:  boolean;
  readonly supportsHmac:   boolean;
  readonly supportsAsync:  boolean;
}

// ── Adapter payload (Mapper output → Adapter input) ──────────────────────────

export interface AdapterPayload {
  readonly raw:       unknown;
  readonly headers?:  Record<string, string>;
  readonly endpoint?: string;
  readonly method?:   "POST" | "GET" | "PUT" | "PATCH";
}

// ── Adapter ──────────────────────────────────────────────────────────────────

export interface IntegrationAdapter {
  readonly name:         string;
  readonly version:      string;
  readonly capabilities: AdapterCapabilities;

  execute(
    payload: AdapterPayload,
    ctx:     IntegrationContext,
    config:  IntegrationConfig,
  ): Promise<DeliveryResult>;
}

// ── Mapper ───────────────────────────────────────────────────────────────────

export interface IntegrationMapper {
  readonly adapterName: string;
  map(event: TransformedEvent, config: IntegrationConfig): AdapterPayload;
}

// ── Integration configuration (per form, per adapter) ────────────────────────

export interface IntegrationConfig {
  readonly id:           string;
  readonly adapterName:  string;
  readonly enabled:      boolean;
  /** Adapter-specific: pixel_id, measurement_id, url, fieldMap… */
  readonly settings:     Record<string, unknown>;
  /** Encrypted at rest in DB; resolved by SecretProvider at runtime. */
  readonly secrets:      Record<string, string>;
  /** If set, only these event types trigger this integration. */
  readonly eventFilter?: string[];
  readonly retryPolicy?: Partial<RetryPolicy>;
  readonly rateLimit?:   { requestsPerMinute: number };
}

// ── Retry policy ──────────────────────────────────────────────────────────────

export interface RetryPolicy {
  maxAttempts:       number;
  initialDelayMs:    number;
  maxDelayMs:        number;
  backoffFactor:     number;
  jitter:            boolean;
  timeoutMs:         number;
  retryableStatuses: number[];
}

// ── Delivery result ───────────────────────────────────────────────────────────

export interface DeliveryResult {
  readonly ok:            boolean;
  readonly status?:       number;
  readonly durationMs:    number;
  readonly attempt:       number;
  readonly correlationId: string;
  readonly retryAfterMs?: number;   // from Retry-After header
  readonly error?:        string;
}

// ── Delivery job (queue item) ─────────────────────────────────────────────────

export interface DeliveryJob {
  readonly deliveryId:    string;
  readonly correlationId: string;
  readonly event:         TransformedEvent;
  readonly config:        IntegrationConfig;
  readonly attempt:       number;
  readonly scheduledAt:   number;
}

// ── Dead Letter Queue entry ───────────────────────────────────────────────────

export interface DeadLetterEntry {
  readonly deliveryId:    string;
  readonly correlationId: string;
  readonly event:         TransformedEvent;
  readonly config:        IntegrationConfig;
  readonly lastError:     string;
  readonly attempts:      number;
  readonly failedAt:      number;
}

// ── Observability ─────────────────────────────────────────────────────────────

export interface IntegrationMetrics {
  readonly adapterName:   string;
  readonly deliveries:    number;
  readonly successes:     number;
  readonly failures:      number;
  readonly retries:       number;
  readonly deadLettered:  number;
  readonly circuitBreaks: number;
  readonly avgLatencyMs:  number;
  readonly p95LatencyMs:  number;
  readonly queueDepth:    number;
  readonly rateLimited:   number;
}

// ── Circuit breaker state ─────────────────────────────────────────────────────

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";
