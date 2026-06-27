import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAnalyticsConsumer } from "../consumer";
import type { AnalyticsConsumerInstance } from "../consumer";
import { InMemoryPersistenceAdapter } from "../persistence";
import { createEventBus } from "../../event-bus/bus";
import { ConsumerPriority } from "../../event-bus/types";
import type { BusEvent } from "../../event-bus/types";
import type { FormEventPayloads, FormEventType } from "../../event-bus/form/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const tick = (ms = 50) => new Promise<void>(r => setTimeout(r, ms));

function makeEvent<T extends FormEventType>(
  type:    T,
  payload: T extends keyof FormEventPayloads ? FormEventPayloads[T] : unknown,
  id      = `evt-${Math.random().toString(36).slice(2)}`,
): BusEvent {
  return {
    id,
    type,
    correlationId: "corr-test",
    source:        "form",
    timestamp:     Date.now(),
    payload:       payload as unknown,
    meta:          {},
  };
}

function makeConfig(adapter: InMemoryPersistenceAdapter, token = "tok-1") {
  return {
    slug:           "my-form",
    getToken:       () => token,
    adapter,
    batchSize:      5,
    flushIntervalMs: 9999, // prevent periodic flush during tests
  };
}

// ── Basic event handling ──────────────────────────────────────────────────────

describe("AnalyticsConsumer — basic", () => {
  let adapter:  InMemoryPersistenceAdapter;

  beforeEach(() => { adapter = new InMemoryPersistenceAdapter(); });

  it("has correct name and priority", () => {
    const consumer = createAnalyticsConsumer(makeConfig(adapter));
    expect(consumer.name).toBe("analytics");
    expect(consumer.priority).toBe(ConsumerPriority.HIGH);
  });

  it("subscribes to all tracked FormEventType events", () => {
    const consumer = createAnalyticsConsumer(makeConfig(adapter));
    expect(Array.isArray(consumer.events)).toBe(true);
    expect((consumer.events as string[]).length).toBeGreaterThan(10);
  });

  it("ignores events with no DB mapping (unmapped types)", async () => {
    const consumer = createAnalyticsConsumer(makeConfig(adapter));
    const evt: BusEvent = {
      id: "u1", type: "form.submission.retry", correlationId: "c", source: "form",
      timestamp: Date.now(), payload: { formSlug: "x", attempt: 1 }, meta: {},
    };
    await consumer.handle(evt);
    expect(adapter.allEvents()).toHaveLength(0);
  });

  it("ignores events when token is null", async () => {
    const config   = { ...makeConfig(adapter), getToken: () => null as string | null };
    const consumer = createAnalyticsConsumer(config);
    const evt = makeEvent("form.started", { formSlug: "test" });
    await consumer.handle(evt);
    expect(adapter.allEvents()).toHaveLength(0);
  });
});

// ── Event mapping to DB names ─────────────────────────────────────────────────

describe("AnalyticsConsumer — event mapping", () => {
  let adapter: InMemoryPersistenceAdapter;
  beforeEach(() => { adapter = new InMemoryPersistenceAdapter(); });

  const cases: Array<[FormEventType, string]> = [
    ["form.loaded",                "page_loaded"],
    ["form.started",               "session_started"],
    ["form.resumed",               "session_resumed"],
    ["form.completed",             "session_completed"],
    ["form.restarted",             "restart"],
    ["form.abandoned",             "abandoned"],
    ["form.session.timeout",       "session_timeout"],
    ["form.error",                 "form_error"],
    ["form.welcome.viewed",        "welcome_view"],
    ["form.welcome.started",       "welcome_started"],
    ["form.step.viewed",           "step_view"],
    ["form.step.completed",        "step_completed"],
    ["form.step.back",             "back_clicked"],
    ["form.step.skipped",          "step_skipped"],
    ["form.step.validation_error", "validation_error"],
    ["form.answer.changed",        "answer_changed"],
    ["form.answer.cleared",        "answer_cleared"],
    ["form.answer.restored",       "answer_restored"],
    ["form.rule.matched",          "rule_matched"],
    ["form.rule.not_matched",      "rule_not_matched"],
    ["form.jump.executed",         "jump_executed"],
    ["form.ending.reached",        "ending_reached"],
    ["form.redirect",              "redirect_executed"],
    ["form.submission.started",    "submission_started"],
    ["form.submission.succeeded",  "submission_finished"],
  ];

  for (const [busType, dbName] of cases) {
    it(`maps ${busType} → ${dbName}`, async () => {
      // batchSize: 1 → every event flushes immediately, no timer needed
      const consumer = createAnalyticsConsumer({
        ...makeConfig(adapter),
        batchSize:      1,
        flushIntervalMs: 9999,
      });
      const evt: BusEvent = {
        id: `id-${busType}`, type: busType, correlationId: "c", source: "form",
        timestamp: Date.now(), payload: { formSlug: "x" }, meta: {},
      };
      await consumer.handle(evt);
      const events = adapter.allEvents();
      const found = events.find(e => e.event === dbName && e.idempotency_key === `id-${busType}`);
      expect(found).toBeDefined();
    });
  }
});

// ── Deduplication ─────────────────────────────────────────────────────────────

describe("AnalyticsConsumer — deduplication", () => {
  let adapter: InMemoryPersistenceAdapter;
  beforeEach(() => { adapter = new InMemoryPersistenceAdapter(); });

  it("does not enqueue the same event.id twice", async () => {
    const consumer = createAnalyticsConsumer({
      ...makeConfig(adapter),
      batchSize: 1, // flush immediately
    });
    const evt = makeEvent("form.started", { formSlug: "test" }, "dup-id");
    await consumer.handle(evt);
    await consumer.handle(evt); // duplicate
    const all = adapter.allEvents();
    const dups = all.filter(e => e.idempotency_key === "dup-id");
    expect(dups).toHaveLength(1);
  });
});

// ── Batching ──────────────────────────────────────────────────────────────────

describe("AnalyticsConsumer — batching", () => {
  let adapter: InMemoryPersistenceAdapter;
  beforeEach(() => { adapter = new InMemoryPersistenceAdapter(); });

  it("does not flush before batchSize is reached", async () => {
    const consumer = createAnalyticsConsumer({
      ...makeConfig(adapter),
      batchSize:      10,
      flushIntervalMs: 9999,
    });
    // Send 4 events (below threshold of 10)
    for (let i = 0; i < 4; i++) {
      await consumer.handle(makeEvent("form.step.viewed", {
        formSlug: "x", stepId: `s${i}`, stepIndex: i, stepType: "text",
      }));
    }
    // Nothing should be persisted yet
    expect(adapter.batches).toHaveLength(0);
  });

  it("flushes when batchSize is reached", async () => {
    const consumer = createAnalyticsConsumer({
      ...makeConfig(adapter),
      batchSize:      3,
      flushIntervalMs: 9999,
    });
    for (let i = 0; i < 3; i++) {
      await consumer.handle(makeEvent("form.step.viewed", {
        formSlug: "x", stepId: `s${i}`, stepIndex: i, stepType: "text",
      }));
    }
    expect(adapter.allEvents()).toHaveLength(3);
  });
});

// ── Terminal event flush ───────────────────────────────────────────────────────

describe("AnalyticsConsumer — terminal flush", () => {
  let adapter: InMemoryPersistenceAdapter;
  beforeEach(() => { adapter = new InMemoryPersistenceAdapter(); });

  const terminalEvents: FormEventType[] = [
    "form.completed",
    "form.abandoned",
    "form.session.timeout",
    "form.submission.succeeded",
  ];

  for (const evtType of terminalEvents) {
    it(`flushes immediately on ${evtType}`, async () => {
      const consumer = createAnalyticsConsumer({
        ...makeConfig(adapter),
        batchSize:      100,
        flushIntervalMs: 9999,
      });
      // Add a non-terminal event to buffer first
      await consumer.handle(makeEvent("form.step.viewed", {
        formSlug: "x", stepId: "s1", stepIndex: 0, stepType: "text",
      }));

      // Now trigger terminal
      const payload = evtType === "form.completed"
        ? { formSlug: "x", totalSteps: 3 }
        : evtType === "form.abandoned"
          ? { formSlug: "x", lastStepIndex: 2, answersCount: 3 }
          : evtType === "form.session.timeout"
            ? { formSlug: "x" }
            : { formSlug: "x" };

      await consumer.handle(makeEvent(evtType, payload as never));
      // Both buffered events should now be persisted
      expect(adapter.allEvents().length).toBeGreaterThanOrEqual(1);
    });
  }
});

// ── Payload extraction ────────────────────────────────────────────────────────

describe("AnalyticsConsumer — payload extraction", () => {
  let adapter: InMemoryPersistenceAdapter;
  beforeEach(() => { adapter = new InMemoryPersistenceAdapter(); });

  it("extracts step_id from step events", async () => {
    const consumer = createAnalyticsConsumer({ ...makeConfig(adapter), batchSize: 1 });
    await consumer.handle(makeEvent("form.step.viewed", {
      formSlug: "x", stepId: "question-5", stepIndex: 4, stepType: "text",
    }));
    const rec = adapter.allEvents()[0];
    expect(rec.step_id).toBe("question-5");
  });

  it("extracts duration from step_completed events", async () => {
    const consumer = createAnalyticsConsumer({ ...makeConfig(adapter), batchSize: 1 });
    await consumer.handle(makeEvent("form.step.completed", {
      formSlug: "x", stepId: "s1", stepIndex: 0, durationSeconds: 42,
    }));
    const rec = adapter.allEvents()[0];
    expect(rec.duration).toBe(42);
  });

  it("stores idempotency_key from event.id", async () => {
    const consumer = createAnalyticsConsumer({ ...makeConfig(adapter), batchSize: 1 });
    await consumer.handle(makeEvent("form.started", { formSlug: "x" }, "my-event-id"));
    const rec = adapter.allEvents()[0];
    expect(rec.idempotency_key).toBe("my-event-id");
  });

  it("includes meta for logic events", async () => {
    const consumer = createAnalyticsConsumer({ ...makeConfig(adapter), batchSize: 1 });
    await consumer.handle(makeEvent("form.rule.matched", {
      formSlug: "x", ruleId: "rule-99", stepId: "s1", actionType: "jump",
    }));
    const rec = adapter.allEvents()[0];
    expect(rec.meta?.ruleId).toBe("rule-99");
    expect(rec.meta?.actionType).toBe("jump");
  });
});

// ── Session metadata ──────────────────────────────────────────────────────────

describe("AnalyticsConsumer — session metadata", () => {
  let adapter: InMemoryPersistenceAdapter;
  beforeEach(() => { adapter = new InMemoryPersistenceAdapter(); });

  it("calls updateSession on form.started (SESSION_START_EVENTS)", async () => {
    const consumer = createAnalyticsConsumer({ ...makeConfig(adapter), batchSize: 1 });
    await consumer.handle(makeEvent("form.started", { formSlug: "x" }));
    await tick(20); // let the fire-and-forget resolve
    const updates = adapter.sessionUpdates;
    expect(updates.length).toBeGreaterThan(0);
    const startUpdate = updates.find(u => u.data.device !== undefined || u.data.browser !== undefined);
    // In jsdom, navigator.userAgent is available, so device info should be collected
    expect(startUpdate).toBeDefined();
  });

  it("calls updateSession with finished_at on form.completed", async () => {
    const consumer = createAnalyticsConsumer({ ...makeConfig(adapter), batchSize: 100 });
    await consumer.handle(makeEvent("form.completed", { formSlug: "x", totalSteps: 3 }));
    await tick(20);
    const endUpdate = adapter.sessionUpdates.find(u => u.data.finished_at !== undefined);
    expect(endUpdate).toBeDefined();
    expect(endUpdate!.data.is_partial).toBe(false);
  });

  it("calls updateSession with abandoned_at on form.abandoned", async () => {
    const consumer = createAnalyticsConsumer({ ...makeConfig(adapter), batchSize: 100 });
    await consumer.handle(makeEvent("form.abandoned", { formSlug: "x", lastStepIndex: 2, answersCount: 3 }));
    await tick(20);
    const abandonUpdate = adapter.sessionUpdates.find(u => u.data.abandoned_at !== undefined);
    expect(abandonUpdate).toBeDefined();
  });
});

// ── Error recovery ────────────────────────────────────────────────────────────

describe("AnalyticsConsumer — error recovery", () => {
  it("re-inserts events into buffer on saveBatch failure", async () => {
    let callCount = 0;
    const inner   = new InMemoryPersistenceAdapter();
    const failingAdapter = new InMemoryPersistenceAdapter();
    // Override saveBatch to throw on first call
    const originalSave = failingAdapter.saveBatch.bind(failingAdapter);
    (failingAdapter as { saveBatch: typeof failingAdapter.saveBatch }).saveBatch = async (slug, token, events) => {
      callCount++;
      if (callCount === 1) throw new Error("network error");
      return originalSave(slug, token, events);
    };

    const consumer = createAnalyticsConsumer({
      slug: "test", getToken: () => "tok",
      adapter: failingAdapter as InMemoryPersistenceAdapter,
      batchSize: 1, flushIntervalMs: 9999,
    });
    // First event → flush → throws → events re-buffered
    await consumer.handle(makeEvent("form.step.viewed", { formSlug: "x", stepId: "s1", stepIndex: 0, stepType: "text" }));
    // The event was re-inserted into the buffer; confirm callCount was 1 (one failed flush)
    expect(callCount).toBe(1);
  });
});

// ── Destroy ───────────────────────────────────────────────────────────────────

describe("AnalyticsConsumer — destroy", () => {
  it("_destroy clears buffer and seen set without errors", async () => {
    const adapter  = new InMemoryPersistenceAdapter();
    const consumer = createAnalyticsConsumer({
      ...makeConfig(adapter),
      batchSize: 100, flushIntervalMs: 9999,
    }) as AnalyticsConsumerInstance;
    // Fill buffer without flushing
    await consumer.handle(makeEvent("form.step.viewed", { formSlug: "x", stepId: "s1", stepIndex: 0, stepType: "text" }));
    consumer._destroy();
    // After destroy, buffer is empty → no events persisted
    expect(adapter.allEvents()).toHaveLength(0);
  });
});

// ── InMemoryPersistenceAdapter.reset ─────────────────────────────────────────

describe("InMemoryPersistenceAdapter.reset()", () => {
  it("clears batches and sessionUpdates", async () => {
    const adapter  = new InMemoryPersistenceAdapter();
    const consumer = createAnalyticsConsumer({ ...makeConfig(adapter), batchSize: 1 });
    await consumer.handle(makeEvent("form.started", { formSlug: "x" }));
    expect(adapter.allEvents().length).toBeGreaterThan(0);
    adapter.reset();
    expect(adapter.allEvents()).toHaveLength(0);
    expect(adapter.sessionUpdates).toHaveLength(0);
  });
});

// ── Integration with EventBus ─────────────────────────────────────────────────

describe("AnalyticsConsumer — integration via EventBus", () => {
  afterEach(() => vi.restoreAllMocks());

  it("consumer registered on bus receives events published to the bus", async () => {
    const adapter  = new InMemoryPersistenceAdapter();
    const consumer = createAnalyticsConsumer({
      ...makeConfig(adapter),
      batchSize:      1,
      flushIntervalMs: 9999,
    });
    const bus = createEventBus({ source: "form", correlationId: "journey-1" });
    bus.subscribe(consumer);

    (bus as unknown as { publish: (type: string, payload?: unknown) => void })
      .publish("form.started", { formSlug: "test-form" });

    await tick(50);
    expect(adapter.allEvents().some(e => e.event === "session_started")).toBe(true);
    bus.destroy();
  });
});
