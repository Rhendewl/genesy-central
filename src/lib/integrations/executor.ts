import type { DeliveryJob, IntegrationConfig, IntegrationContext } from "./types";
import type { CircuitBreakerRegistry } from "./circuit-breaker";
import type { RateLimiter } from "./rate-limiter";
import type { SecretProvider } from "./security/secret-provider";
import type { IntegrationRegistry } from "./registry";
import type { DeadLetterQueue } from "./dead-letter";
import type { IntegrationObserver } from "./observer";
import type { RetryStrategy } from "./retry-strategy";
import type { SchemaValidator } from "./schema-validator";
import { DEFAULT_RETRY_POLICY, isRetryable, mergeRetryPolicy } from "./retry";
import { exponentialRetryStrategy } from "./retry-strategy";

export interface DeliveryExecutorOptions {
  registry:        IntegrationRegistry;
  circuitBreakers: CircuitBreakerRegistry;
  rateLimiter:     RateLimiter;
  secretProvider:  SecretProvider;
  dlq:             DeadLetterQueue;
  observer:        IntegrationObserver;
  retryStrategy?:  RetryStrategy;
  validator?:      SchemaValidator;
  requeue:         (job: DeliveryJob, delayMs: number) => void;
}

export class DeliveryExecutor {
  private readonly opts:          DeliveryExecutorOptions;
  private readonly retryStrategy: RetryStrategy;

  constructor(opts: DeliveryExecutorOptions) {
    this.opts          = opts;
    this.retryStrategy = opts.retryStrategy ?? exponentialRetryStrategy;
  }

  async execute(job: DeliveryJob): Promise<void> {
    const { registry, circuitBreakers, rateLimiter, secretProvider, dlq, observer, validator } = this.opts;
    const { event, config, attempt, deliveryId, correlationId } = job;
    const adapterName = config.adapterName;

    // 1. Circuit breaker gate.
    const cb = circuitBreakers.get(adapterName);
    if (!cb.canProceed()) {
      observer.recordCircuitBreak(adapterName);
      return;
    }

    // 2. Rate limiting.
    if (config.rateLimit) {
      const key = `${adapterName}:${event.formSlug}`;
      if (!rateLimiter.acquire(key, config.rateLimit.requestsPerMinute)) {
        observer.recordRateLimit(adapterName);
        const delayMs = Math.ceil(60_000 / config.rateLimit.requestsPerMinute);
        this.opts.requeue({ ...job }, delayMs);
        return;
      }
    }

    // 3. Resolve secrets (decrypted at execution time only).
    const secrets         = await secretProvider.resolve(config.secrets);
    const resolvedConfig: IntegrationConfig = { ...config, secrets };

    // 4. Resolve mapper and adapter.
    const mapper  = registry.getMapper(adapterName);
    const adapter = registry.getAdapter(adapterName);
    if (!mapper || !adapter) return;

    // 5. Optional schema validation before mapping.
    if (validator) {
      const valid = await validator.validate(event, resolvedConfig);
      if (!valid) return;
    }

    // 6. Map event → AdapterPayload.
    const payload = mapper.map(event, resolvedConfig);

    // 7. Execute with timeout signal.
    const retryPolicy = mergeRetryPolicy(DEFAULT_RETRY_POLICY, config.retryPolicy);
    const ctrl        = new AbortController();
    const timeout     = setTimeout(() => ctrl.abort(), retryPolicy.timeoutMs);

    const ctx: IntegrationContext = {
      deliveryId,
      correlationId,
      attempt,
      maxAttempts: retryPolicy.maxAttempts,
      timeoutMs:   retryPolicy.timeoutMs,
      signal:      ctrl.signal,
    };

    let result;
    try {
      result = await adapter.execute(payload, ctx, resolvedConfig);
    } finally {
      clearTimeout(timeout);
    }

    observer.recordDelivery(adapterName, result);

    if (result.ok) {
      cb.recordSuccess();
      return;
    }

    cb.recordFailure();

    // 8. Retry or dead-letter.
    if (attempt < retryPolicy.maxAttempts && isRetryable(result.status, retryPolicy)) {
      const delayMs = result.retryAfterMs ?? this.retryStrategy.computeDelay(retryPolicy, attempt);
      observer.recordRetry(adapterName);
      this.opts.requeue({ ...job, attempt: attempt + 1 }, delayMs);
    } else {
      observer.recordDeadLetter(adapterName);
      dlq.add({
        deliveryId,
        correlationId,
        event,
        config,
        lastError: result.error ?? "unknown",
        attempts:  attempt,
        failedAt:  Date.now(),
      });
    }
  }
}
