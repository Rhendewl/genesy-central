import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DeliveryQueue }           from "../queue";
import { IntegrationRegistry }     from "../registry";
import { CircuitBreakerRegistry }  from "../circuit-breaker";
import { RateLimiter }             from "../rate-limiter";
import { PlainSecretProvider }     from "../security/secret-provider";
import { DeadLetterQueue }         from "../dead-letter";
import { IntegrationObserver }     from "../observer";
import { WebhookAdapter }          from "../adapters/webhook";
import { webhookMapper }           from "../mappers/webhook";
import { makeConfig, makeEvent, tick } from "./helpers";
import type { DeliveryJob, IntegrationAdapter, AdapterPayload, IntegrationContext, IntegrationConfig, DeliveryResult } from "../types";

// ── Test doubles ──────────────────────────────────────────────────────────────

function makeSuccessAdapter(name = "webhook"): IntegrationAdapter {
  return {
    name,
    version: "1.0",
    capabilities: { supportsBatch: false, supportsRetry: true, supportsOAuth: false, supportsHmac: false, supportsAsync: true },
    async execute(_p: AdapterPayload, ctx: IntegrationContext): Promise<DeliveryResult> {
      return { ok: true, status: 200, durationMs: 10, attempt: ctx.attempt, correlationId: ctx.correlationId };
    },
  };
}

function makeFailAdapter(name = "webhook", status = 500): IntegrationAdapter {
  return {
    name,
    version: "1.0",
    capabilities: { supportsBatch: false, supportsRetry: true, supportsOAuth: false, supportsHmac: false, supportsAsync: true },
    async execute(_p: AdapterPayload, ctx: IntegrationContext): Promise<DeliveryResult> {
      return { ok: false, status, durationMs: 10, attempt: ctx.attempt, correlationId: ctx.correlationId, error: `HTTP ${status}` };
    },
  };
}

function makeQueue(adapter: IntegrationAdapter, opts: Partial<ConstructorParameters<typeof DeliveryQueue>[0]> = {}) {
  const registry = new IntegrationRegistry();
  registry.register(adapter, webhookMapper);

  const circuitBreakers = new CircuitBreakerRegistry();
  const rateLimiter     = new RateLimiter();
  const secretProvider  = new PlainSecretProvider();
  const dlq             = new DeadLetterQueue();
  const observer        = new IntegrationObserver();

  const queue = new DeliveryQueue({
    registry, circuitBreakers, rateLimiter, secretProvider, dlq, observer,
    ...opts,
  });

  return { queue, registry, circuitBreakers, rateLimiter, dlq, observer };
}

function makeJob(attempt = 1, configOverride: Partial<Parameters<typeof makeConfig>[0]> = {}): DeliveryJob {
  return {
    deliveryId:    "del-1",
    correlationId: "corr-1",
    event:         makeEvent("form.started"),
    config:        makeConfig({ adapterName: "webhook", settings: { url: "https://x.com" }, retryPolicy: { maxAttempts: 3, initialDelayMs: 0, jitter: false }, ...configOverride }),
    attempt,
    scheduledAt:   Date.now(),
  };
}

afterEach(() => vi.restoreAllMocks());

// ── Basic delivery ────────────────────────────────────────────────────────────

describe("DeliveryQueue — successful delivery", () => {
  it("processes a job and records success in observer", async () => {
    const { queue, observer } = makeQueue(makeSuccessAdapter());
    queue.enqueue(makeJob());
    await tick(50);
    expect(observer.snapshot("webhook").successes).toBe(1);
    expect(observer.snapshot("webhook").deliveries).toBe(1);
  });

  it("depth() decrements after processing", async () => {
    const { queue } = makeQueue(makeSuccessAdapter());
    queue.enqueue(makeJob());
    await tick(50);
    expect(queue.depth()).toBe(0);
  });
});

// ── Circuit breaker ───────────────────────────────────────────────────────────

describe("DeliveryQueue — circuit breaker", () => {
  it("skips job when circuit is OPEN and records circuit break", async () => {
    const { queue, circuitBreakers, observer } = makeQueue(makeSuccessAdapter());
    const cb = circuitBreakers.get("webhook");
    // Force circuit open
    for (let i = 0; i < 5; i++) cb.recordFailure();

    queue.enqueue(makeJob());
    await tick(50);
    expect(observer.snapshot("webhook").circuitBreaks).toBe(1);
    expect(observer.snapshot("webhook").successes).toBe(0);
  });
});

// ── Retry on failure ──────────────────────────────────────────────────────────

// Helper: policy with 0ms delay → retries fire immediately without fake timers.
function zeroDelayJob(attempt = 1): DeliveryJob {
  return makeJob(attempt, {
    retryPolicy: { maxAttempts: 3, initialDelayMs: 0, maxDelayMs: 0, jitter: false, timeoutMs: 5000, backoffFactor: 1, retryableStatuses: [500] },
  });
}

describe("DeliveryQueue — retry", () => {
  it("retries after failure and records retry metric", async () => {
    const calls: number[] = [];
    const countingAdapter: IntegrationAdapter = {
      ...makeFailAdapter(),
      async execute(_p, ctx) {
        calls.push(ctx.attempt);
        return { ok: false, status: 500, durationMs: 1, attempt: ctx.attempt, correlationId: ctx.correlationId, error: "err" };
      },
    };
    const { queue, observer } = makeQueue(countingAdapter);
    queue.enqueue(zeroDelayJob());
    await tick(200);  // 0ms retries fire immediately in the next microtask cycle
    expect(calls.length).toBeGreaterThan(1);
    expect(observer.snapshot("webhook").retries).toBeGreaterThan(0);
  });

  it("sends job to DLQ after maxAttempts exhausted", async () => {
    const { queue, dlq } = makeQueue(makeFailAdapter());
    queue.enqueue(zeroDelayJob());
    await tick(200);
    expect(dlq.size()).toBe(1);
    expect(dlq.all()[0].lastError).toContain("500");
    expect(dlq.all()[0].correlationId).toBe("corr-1");
  });

  it("does NOT retry non-retryable status (400)", async () => {
    let callCount = 0;
    const adapter: IntegrationAdapter = {
      ...makeFailAdapter("webhook", 400),
      async execute(_p, ctx) {
        callCount++;
        return { ok: false, status: 400, durationMs: 1, attempt: ctx.attempt, correlationId: ctx.correlationId, error: "Bad Request" };
      },
    };
    const { queue, dlq } = makeQueue(adapter);
    queue.enqueue(zeroDelayJob());
    await tick(100);
    expect(callCount).toBe(1);      // no retry for 400
    expect(dlq.size()).toBe(1);
  });
});

// ── Rate limiting ─────────────────────────────────────────────────────────────

describe("DeliveryQueue — rate limiting", () => {
  it("records rateLimited metric and re-queues for later", async () => {
    const { queue, rateLimiter, observer } = makeQueue(makeSuccessAdapter());
    // Pre-drain the rate limiter bucket so the first attempt is rate limited.
    // We need Date.now() to return a fixed value so the bucket doesn't auto-refill.
    const fixedNow = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(fixedNow);
    rateLimiter.acquire("webhook:my-form", 1);  // drains the single token

    const job = makeJob(1, { rateLimit: { requestsPerMinute: 1 } });
    queue.enqueue(job);

    // Wait for one processJob cycle (rate-limited → scheduleRetry at 60s)
    await tick(50);
    vi.restoreAllMocks();

    // The job was rate-limited, not dispatched
    expect(observer.snapshot("webhook").rateLimited).toBeGreaterThanOrEqual(1);
    expect(observer.snapshot("webhook").successes).toBe(0);
  });
});

// ── Unknown adapter ───────────────────────────────────────────────────────────

describe("DeliveryQueue — unknown adapter", () => {
  it("silently skips when adapter is not in registry", async () => {
    const { queue, observer } = makeQueue(makeSuccessAdapter());
    const job = makeJob(1, { adapterName: "unknown-adapter" });
    queue.enqueue(job);
    await tick(50);
    expect(observer.snapshot("unknown-adapter").deliveries).toBe(0);
  });
});
