// ── Core ──────────────────────────────────────────────────────────────────────
export type {
  BusEvent,
  EventBus,
  EventBusConfig,
  EventBusObserver,
  EventConsumer,
  EventMeta,
  ConsumerStat,
  MiddlewareFn,
  PublishInput,
  RetryConfig,
  StorageAdapter,
} from "./types";
export { ConsumerPriority } from "./types";

// ── Factory ───────────────────────────────────────────────────────────────────
export { createEventBus, generateId } from "./bus";

// ── Storage ───────────────────────────────────────────────────────────────────
export { LocalStorageAdapter, InMemoryAdapter } from "./storage";

// ── Middleware ─────────────────────────────────────────────────────────────────
export {
  applyMiddlewares,
  urlEnrichMiddleware,
  stripNullsMiddleware,
  debugLogMiddleware,
} from "./middleware";

// ── Observability ─────────────────────────────────────────────────────────────
export { attachDevtools, printSnapshot, installDebugConsumer } from "./observability";
