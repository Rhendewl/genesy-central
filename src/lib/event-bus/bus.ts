import type {
  BusEvent,
  ConsumerStat,
  EventBus,
  EventBusConfig,
  EventBusObserver,
  EventConsumer,
  MiddlewareFn,
  PublishInput,
} from "./types";
import { ConsumerPriority } from "./types";
import { LocalStorageAdapter } from "./storage";
import { PersistentQueue } from "./queue";
import { applyMiddlewares } from "./middleware";

// ── Utilities ─────────────────────────────────────────────────────────────────

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof (crypto as Crypto).randomUUID === "function") {
    return (crypto as Crypto).randomUUID();
  }
  /* v8 ignore next 2 */
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function defaultRetryConfig(priority: ConsumerPriority): {
  maxAttempts: number;
  backoffMs:   number;
  persist:     boolean;
} {
  if (priority === ConsumerPriority.CRITICAL) return { maxAttempts: 5, backoffMs: 1000, persist: true };
  if (priority === ConsumerPriority.HIGH)     return { maxAttempts: 3, backoffMs: 1000, persist: false };
  if (priority === ConsumerPriority.NORMAL)   return { maxAttempts: 2, backoffMs: 800,  persist: false };
  return { maxAttempts: 1, backoffMs: 0, persist: false };
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createEventBus<TType extends string = string>(
  config: EventBusConfig<TType>,
): EventBus<TType> {
  const { source, meta: baseMeta = {}, debug = false } = config;

  const correlationId = config.correlationId ?? generateId();
  const storage       = config.storage ?? new LocalStorageAdapter();
  const queue         = new PersistentQueue(storage, source);

  // Mutable state — plain arrays for ES3 compat (no Map/Set iteration)
  const consumers:   EventConsumer[] = config.consumers ? [...config.consumers] : [];
  const middlewares: MiddlewareFn[]  = config.middlewares ? [...config.middlewares] : [];

  let destroyed = false;

  // ── Observability counters ─────────────────────────────────────────────────
  let cntPublished  = 0;
  let cntDispatched = 0;
  let cntDropped    = 0;
  let cntFailed     = 0;

  // Per-consumer mutable stats (keyed by consumer name)
  const consumerStats: { [name: string]: { dispatched: number; succeeded: number; failed: number; retried: number } } = {};
  const recentEvents: BusEvent[] = [];
  const MAX_RECENT = 20;

  function ensureConsumerStat(name: string): void {
    if (!consumerStats[name]) {
      consumerStats[name] = { dispatched: 0, succeeded: 0, failed: 0, retried: 0 };
    }
  }

  // ── Dispatch one consumer ──────────────────────────────────────────────────

  async function dispatchToConsumer(consumer: EventConsumer, event: BusEvent): Promise<void> {
    const retry = consumer.retry ?? defaultRetryConfig(consumer.priority);
    ensureConsumerStat(consumer.name);

    if (debug) consumerStats[consumer.name].dispatched++;

    for (let attempt = 1; attempt <= retry.maxAttempts; attempt++) {
      try {
        await Promise.resolve(consumer.handle(event));
        if (debug) consumerStats[consumer.name].succeeded++;
        queue.acknowledge(event.id, consumer.name);
        return;
      } catch (err) {
        if (debug) {
          console.warn(`[EventBus] "${consumer.name}" attempt ${attempt}/${retry.maxAttempts} failed:`, err);
        }

        const isLast = attempt === retry.maxAttempts;

        if (!isLast) {
          if (debug) consumerStats[consumer.name].retried++;
          // Persist to queue on first failure for CRITICAL consumers
          if (retry.persist && attempt === 1) {
            queue.enqueue(event, consumer.name, attempt);
          }
          await new Promise<void>((resolve) => setTimeout(resolve, retry.backoffMs * attempt));
        } else {
          cntFailed++;
          if (debug) {
            consumerStats[consumer.name].failed++;
            console.error(`[EventBus] "${consumer.name}" exhausted retries for "${event.type}".`);
          }
          // Keep in queue for cross-session flush
          if (retry.persist) {
            queue.enqueue(event, consumer.name, attempt);
          }
        }
      }
    }
  }

  // ── Core dispatch (async, fire-and-forget) ─────────────────────────────────

  async function dispatch(event: BusEvent): Promise<void> {
    if (destroyed) return;

    // Apply middleware pipeline
    const processed = applyMiddlewares(event, middlewares);
    if (!processed) {
      cntDropped++;
      if (debug) console.debug(`[EventBus] "${event.type}" dropped by middleware.`);
      return;
    }

    // Filter matching consumers
    const matching: EventConsumer[] = [];
    for (let i = 0; i < consumers.length; i++) {
      const c = consumers[i];
      if (c.events === "*" || (c.events as string[]).indexOf(processed.type) !== -1) {
        matching.push(c);
      }
    }

    if (matching.length === 0) return;

    cntDispatched++;

    if (debug) {
      recentEvents.push(processed);
      if (recentEvents.length > MAX_RECENT) recentEvents.shift();
    }

    // Sort by priority (ascending = CRITICAL first)
    matching.sort((a, b) => a.priority - b.priority);

    // Execute in priority groups: parallel within same priority, sequential across groups
    let i = 0;
    while (i < matching.length) {
      const currentPriority = matching[i].priority;
      const group: EventConsumer[] = [];

      while (i < matching.length && matching[i].priority === currentPriority) {
        group.push(matching[i]);
        i++;
      }

      await Promise.allSettled(group.map((c) => dispatchToConsumer(c, processed)));
    }
  }

  // ── Build event ────────────────────────────────────────────────────────────

  function buildEvent(type: TType, payload: unknown, corrId?: string): BusEvent<TType> {
    return {
      id:            generateId(),
      type,
      correlationId: corrId ?? correlationId,
      source,
      timestamp:     Date.now(),
      payload:       payload ?? {},
      meta:          { ...baseMeta },
    };
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async function publish(type: TType, payload?: unknown): Promise<void> {
    if (destroyed) return;
    cntPublished++;
    const event = buildEvent(type, payload);
    await dispatch(event);
  }

  function publishBatch(events: ReadonlyArray<PublishInput<TType>>): void {
    if (destroyed) return;
    for (let i = 0; i < events.length; i++) {
      const input = events[i];
      cntPublished++;
      const event = buildEvent(input.type, input.payload, input.correlationId);
      void dispatch(event);
    }
  }

  function subscribe(consumer: EventConsumer): () => void {
    consumers.push(consumer);
    return function unsubscribe() {
      const idx = consumers.indexOf(consumer);
      if (idx !== -1) consumers.splice(idx, 1);
    };
  }

  function use(middleware: MiddlewareFn): () => void {
    middlewares.push(middleware);
    return function remove() {
      const idx = middlewares.indexOf(middleware);
      if (idx !== -1) middlewares.splice(idx, 1);
    };
  }

  async function flush(): Promise<void> {
    if (destroyed) return;
    // Retry queued CRITICAL events for each consumer
    for (let ci = 0; ci < consumers.length; ci++) {
      const consumer = consumers[ci];
      if (consumer.priority !== ConsumerPriority.CRITICAL) continue;

      const entries = queue.dequeue(consumer.name);
      for (let ei = 0; ei < entries.length; ei++) {
        const entry = entries[ei];
        try {
          await Promise.resolve(consumer.handle(entry.event));
          queue.acknowledge(entry.event.id, consumer.name);
        } catch {
          // Leave in queue for next flush
        }
      }
    }
  }

  function destroy(): void {
    destroyed = true;
    consumers.length   = 0;
    middlewares.length = 0;
  }

  // ── Observability module (only when debug: true) ───────────────────────────

  const obs: EventBusObserver | undefined = debug
    ? {
        get published()    { return cntPublished; },
        get dispatched()   { return cntDispatched; },
        get dropped()      { return cntDropped; },
        get failed()       { return cntFailed; },
        get queued()       { return queue.size(); },
        get consumers(): ReadonlyArray<ConsumerStat> {
          return Object.keys(consumerStats).map((name) => ({
            name,
            ...consumerStats[name],
          }));
        },
        get recentEvents() { return recentEvents.slice(); },
        reset() {
          cntPublished = cntDispatched = cntDropped = cntFailed = 0;
          const keys = Object.keys(consumerStats);
          for (let i = 0; i < keys.length; i++) {
            consumerStats[keys[i]] = { dispatched: 0, succeeded: 0, failed: 0, retried: 0 };
          }
          recentEvents.length = 0;
        },
        snapshot(): Record<string, unknown> {
          return {
            published:  cntPublished,
            dispatched: cntDispatched,
            dropped:    cntDropped,
            failed:     cntFailed,
            queued:     queue.size(),
            consumers:  Object.keys(consumerStats).map((name) => ({ name, ...consumerStats[name] })),
          };
        },
      }
    : undefined;

  return Object.freeze({
    publish,
    publishBatch,
    subscribe,
    use,
    flush,
    destroy,
    correlationId,
    obs,
  });
}

// Re-export generateId for consumers/hooks that need to seed their own correlationId
export { generateId };
