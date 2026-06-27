// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  IntegrationEvent, TransformedEvent, IntegrationContext, AdapterCapabilities,
  AdapterPayload, IntegrationAdapter, IntegrationMapper, IntegrationConfig,
  RetryPolicy, DeliveryResult, DeliveryJob, DeadLetterEntry, IntegrationMetrics,
  CircuitState,
} from "./types";

// ── Retry ─────────────────────────────────────────────────────────────────────
export { DEFAULT_RETRY_POLICY, computeDelay, isRetryable, mergeRetryPolicy } from "./retry";

// ── Retry strategy ────────────────────────────────────────────────────────────
export { exponentialRetryStrategy } from "./retry-strategy";
export type { RetryStrategy } from "./retry-strategy";

// ── Scheduler ─────────────────────────────────────────────────────────────────
export { TimerScheduler } from "./scheduler";
export type { Scheduler } from "./scheduler";

// ── Schema validator ──────────────────────────────────────────────────────────
export { NoopSchemaValidator } from "./schema-validator";
export type { SchemaValidator } from "./schema-validator";

// ── Circuit breaker ───────────────────────────────────────────────────────────
export { CircuitBreaker, CircuitBreakerRegistry } from "./circuit-breaker";
export type { CircuitBreakerConfig } from "./circuit-breaker";

// ── Rate limiter ──────────────────────────────────────────────────────────────
export { RateLimiter } from "./rate-limiter";

// ── Observer ──────────────────────────────────────────────────────────────────
export { IntegrationObserver } from "./observer";

// ── Dead letter queue ─────────────────────────────────────────────────────────
export { DeadLetterQueue } from "./dead-letter";

// ── Transform pipeline ────────────────────────────────────────────────────────
export { createTransformPipeline } from "./pipeline/pipeline";
export { PipelineBuilder }         from "./pipeline/builder";
export { normalizeTransform }      from "./pipeline/transforms/normalize";
export { enrichTransform }         from "./pipeline/transforms/enrich";
export { maskTransform }           from "./pipeline/transforms/mask";
export type { TransformFn, TransformPipeline, TransformContext } from "./pipeline/types";

// ── Security ──────────────────────────────────────────────────────────────────
export { signPayload, verifyPayload }             from "./security/hmac";
export { PlainSecretProvider, EnvSecretProvider } from "./security/secret-provider";
export type { SecretProvider }                    from "./security/secret-provider";

// ── Registry ──────────────────────────────────────────────────────────────────
export { IntegrationRegistry } from "./registry";

// ── Executor ──────────────────────────────────────────────────────────────────
export { DeliveryExecutor } from "./executor";
export type { DeliveryExecutorOptions } from "./executor";

// ── Queue ─────────────────────────────────────────────────────────────────────
export { DeliveryQueue } from "./queue";
export type { DeliveryQueueOptions } from "./queue";

// ── Dispatcher ────────────────────────────────────────────────────────────────
export { Dispatcher, InMemoryConfigLoader } from "./dispatcher";
export type { ConfigLoader, DispatcherOptions } from "./dispatcher";

// ── Manager ───────────────────────────────────────────────────────────────────
export { createIntegrationManager } from "./manager";
export type { IntegrationManagerOptions } from "./manager";

// ── Mappers ───────────────────────────────────────────────────────────────────
export { metaMapper }            from "./mappers/meta";
export { googleAnalyticsMapper } from "./mappers/google-analytics";
export { webhookMapper }         from "./mappers/webhook";
export { crmMapper }             from "./mappers/crm";

// ── Adapters ──────────────────────────────────────────────────────────────────
export { MetaPixelAdapter }       from "./adapters/meta-pixel";
export { GoogleAnalyticsAdapter } from "./adapters/google-analytics";
export { WebhookAdapter }         from "./adapters/webhook";
export { CRMAdapter }             from "./adapters/crm";
