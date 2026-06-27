import { describe, it, expect, vi, afterEach } from "vitest";
import { DeliveryExecutor } from "../executor";
import { CircuitBreakerRegistry } from "../circuit-breaker";
import { RateLimiter }            from "../rate-limiter";
import { PlainSecretProvider }    from "../security/secret-provider";
import { DeadLetterQueue }        from "../dead-letter";
import { IntegrationObserver }    from "../observer";
import { IntegrationRegistry }    from "../registry";
import { webhookMapper }          from "../mappers/webhook";
import { makeConfig, makeEvent, tick } from "./helpers";
import type { IntegrationAdapter, AdapterPayload, IntegrationContext, DeliveryResult, DeliveryJob } from "../types";
import type { SchemaValidator } from "../schema-validator";

afterEach(() => vi.restoreAllMocks());

function makeSuccessAdapter(name = "webhook"): IntegrationAdapter {
  return {
    name,
    version: "1.0",
    capabilities: { supportsBatch: false, supportsRetry: true, supportsOAuth: false, supportsHmac: false, supportsAsync: true },
    async execute(_p: AdapterPayload, ctx: IntegrationContext): Promise<DeliveryResult> {
      return { ok: true, status: 200, durationMs: 5, attempt: ctx.attempt, correlationId: ctx.correlationId };
    },
  };
}

function makeFailAdapter(status = 500): IntegrationAdapter {
  return {
    name: "webhook",
    version: "1.0",
    capabilities: { supportsBatch: false, supportsRetry: true, supportsOAuth: false, supportsHmac: false, supportsAsync: true },
    async execute(_p: AdapterPayload, ctx: IntegrationContext): Promise<DeliveryResult> {
      return { ok: false, status, durationMs: 5, attempt: ctx.attempt, correlationId: ctx.correlationId, error: `HTTP ${status}` };
    },
  };
}

function makeExecutor(adapter: IntegrationAdapter, opts: {
  requeue?: (job: DeliveryJob, delay: number) => void;
  validator?: SchemaValidator;
} = {}) {
  const registry = new IntegrationRegistry();
  registry.register(adapter, webhookMapper);

  const circuitBreakers = new CircuitBreakerRegistry();
  const rateLimiter     = new RateLimiter();
  const secretProvider  = new PlainSecretProvider();
  const dlq             = new DeadLetterQueue();
  const observer        = new IntegrationObserver();
  const requeue         = opts.requeue ?? vi.fn();

  const executor = new DeliveryExecutor({
    registry, circuitBreakers, rateLimiter, secretProvider, dlq, observer,
    validator: opts.validator,
    requeue,
  });

  return { executor, circuitBreakers, rateLimiter, dlq, observer, requeue };
}

function makeJob(configOverride: Partial<Parameters<typeof makeConfig>[0]> = {}): DeliveryJob {
  return {
    deliveryId:    "del-1",
    correlationId: "corr-1",
    event:         makeEvent("form.started"),
    config:        makeConfig({ adapterName: "webhook", settings: { url: "https://x.com" }, ...configOverride }),
    attempt:       1,
    scheduledAt:   Date.now(),
  };
}

// ── Successful delivery ────────────────────────────────────────────────────────

describe("DeliveryExecutor — success", () => {
  it("records delivery success in observer", async () => {
    const { executor, observer } = makeExecutor(makeSuccessAdapter());
    await executor.execute(makeJob());
    expect(observer.snapshot("webhook").successes).toBe(1);
    expect(observer.snapshot("webhook").deliveries).toBe(1);
  });

  it("records circuit breaker success after delivery", async () => {
    const { executor, circuitBreakers } = makeExecutor(makeSuccessAdapter());
    const cb = circuitBreakers.get("webhook");
    cb.recordFailure();
    cb.recordFailure();  // 2 failures, still CLOSED
    await executor.execute(makeJob());
    expect(cb.getState()).toBe("CLOSED");
  });
});

// ── Circuit breaker gate ──────────────────────────────────────────────────────

describe("DeliveryExecutor — circuit breaker", () => {
  it("skips job and records circuit break when OPEN", async () => {
    const { executor, circuitBreakers, observer } = makeExecutor(makeSuccessAdapter());
    const cb = circuitBreakers.get("webhook");
    for (let i = 0; i < 5; i++) cb.recordFailure();  // open

    await executor.execute(makeJob());
    expect(observer.snapshot("webhook").circuitBreaks).toBe(1);
    expect(observer.snapshot("webhook").successes).toBe(0);
  });
});

// ── Rate limiting ─────────────────────────────────────────────────────────────

describe("DeliveryExecutor — rate limiting", () => {
  it("calls requeue with correct delay when bucket is empty", async () => {
    const requeue = vi.fn();
    const { executor, rateLimiter } = makeExecutor(makeSuccessAdapter(), { requeue });
    const fixedNow = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(fixedNow);
    rateLimiter.acquire("webhook:my-form", 1);  // drain

    const job = makeJob({ rateLimit: { requestsPerMinute: 1 } });
    await executor.execute(job);
    expect(requeue).toHaveBeenCalledOnce();
    expect(requeue.mock.calls[0][1]).toBe(60_000);  // 60s delay for 1 req/min
  });
});

// ── Unknown adapter ───────────────────────────────────────────────────────────

describe("DeliveryExecutor — unknown adapter", () => {
  it("silently skips when adapter is not registered", async () => {
    const { executor, observer } = makeExecutor(makeSuccessAdapter());
    const job = makeJob({ adapterName: "ghost-adapter" });
    await executor.execute(job);
    expect(observer.snapshot("ghost-adapter").deliveries).toBe(0);
  });
});

// ── Schema validator ──────────────────────────────────────────────────────────

describe("DeliveryExecutor — schema validator", () => {
  it("skips execution when validator returns false", async () => {
    const rejectValidator: SchemaValidator = {
      validate: () => false,
    };
    const { executor, observer } = makeExecutor(makeSuccessAdapter(), { validator: rejectValidator });
    await executor.execute(makeJob());
    expect(observer.snapshot("webhook").deliveries).toBe(0);
  });

  it("executes normally when validator returns true", async () => {
    const acceptValidator: SchemaValidator = {
      validate: () => true,
    };
    const { executor, observer } = makeExecutor(makeSuccessAdapter(), { validator: acceptValidator });
    await executor.execute(makeJob());
    expect(observer.snapshot("webhook").successes).toBe(1);
  });

  it("supports async validator", async () => {
    const asyncValidator: SchemaValidator = {
      validate: async () => Promise.resolve(false),
    };
    const { executor, observer } = makeExecutor(makeSuccessAdapter(), { validator: asyncValidator });
    await executor.execute(makeJob());
    expect(observer.snapshot("webhook").deliveries).toBe(0);
  });
});

// ── Retry on failure ──────────────────────────────────────────────────────────

describe("DeliveryExecutor — retry", () => {
  it("calls requeue on retryable failure", async () => {
    const requeue = vi.fn();
    const { executor } = makeExecutor(makeFailAdapter(500), { requeue });
    const job = makeJob({
      retryPolicy: { maxAttempts: 3, initialDelayMs: 0, maxDelayMs: 0, jitter: false, timeoutMs: 5000, backoffFactor: 1, retryableStatuses: [500] },
    });
    await executor.execute(job);
    expect(requeue).toHaveBeenCalledOnce();
  });

  it("sends to DLQ when maxAttempts is 1 and failure occurs", async () => {
    const { executor, dlq } = makeExecutor(makeFailAdapter(500));
    const job = makeJob({
      retryPolicy: { maxAttempts: 1, initialDelayMs: 0, maxDelayMs: 0, jitter: false, timeoutMs: 5000, backoffFactor: 1, retryableStatuses: [500] },
    });
    await executor.execute(job);
    expect(dlq.size()).toBe(1);
    expect(dlq.all()[0].correlationId).toBe("corr-1");
  });
});
