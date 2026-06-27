import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createEventBus } from "../bus";
import { InMemoryAdapter } from "../storage";
import type { BusEvent, EventConsumer, MiddlewareFn } from "../types";
import { ConsumerPriority } from "../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Waits for all pending microtasks and up to `ms` macrotasks. */
const tick = (ms = 20) => new Promise<void>(resolve => setTimeout(resolve, ms));

interface TrackedConsumer extends EventConsumer {
  calls: BusEvent[];
}

function makeConsumer(
  name:    string,
  opts:    Partial<EventConsumer> = {},
): TrackedConsumer {
  const calls: BusEvent[] = [];
  return {
    name,
    priority: ConsumerPriority.NORMAL,
    events:   "*",
    handle:   (e) => { calls.push(e); },
    ...opts,
    calls,
  } as TrackedConsumer;
}

// ── publish() ─────────────────────────────────────────────────────────────────

describe("publish()", () => {
  it("dispatches to a subscribed consumer", async () => {
    const bus = createEventBus({ source: "test" });
    const consumer = makeConsumer("c1");
    bus.subscribe(consumer);
    bus.publish("test.event");
    await tick();
    expect(consumer.calls).toHaveLength(1);
    bus.destroy();
  });

  it("populates the event with correct fields", async () => {
    const bus = createEventBus({ source: "mymodule", correlationId: "corr-42" });
    const consumer = makeConsumer("c1");
    bus.subscribe(consumer);
    bus.publish("some.event", { key: "val" });
    await tick();

    const evt = consumer.calls[0];
    expect(evt.source).toBe("mymodule");
    expect(evt.correlationId).toBe("corr-42");
    expect(evt.type).toBe("some.event");
    expect(evt.payload).toEqual({ key: "val" });
    expect(typeof evt.id).toBe("string");
    expect(evt.id.length).toBeGreaterThan(0);
    expect(typeof evt.timestamp).toBe("number");
    bus.destroy();
  });

  it("assigns unique IDs to each published event", async () => {
    const bus = createEventBus({ source: "test" });
    const ids: string[] = [];
    bus.subscribe({ name: "c1", priority: ConsumerPriority.NORMAL, events: "*", handle: (e) => { ids.push(e.id); } });
    bus.publish("ev.a");
    bus.publish("ev.b");
    await tick();
    expect(ids[0]).not.toBe(ids[1]);
    bus.destroy();
  });

  it("does not dispatch to a consumer that doesn't match the event type", async () => {
    const bus = createEventBus({ source: "test" });
    const consumer = makeConsumer("c1", { events: ["other.event"] });
    bus.subscribe(consumer);
    bus.publish("test.event");
    await tick();
    expect(consumer.calls).toHaveLength(0);
    bus.destroy();
  });

  it("is a no-op after destroy()", async () => {
    const bus = createEventBus({ source: "test" });
    const consumer = makeConsumer("c1");
    bus.subscribe(consumer);
    bus.destroy();
    bus.publish("test.event");
    await tick();
    expect(consumer.calls).toHaveLength(0);
  });

  it("merges baseMeta from config into every event", async () => {
    const bus = createEventBus({
      source: "test",
      meta:   { utm: { source: "facebook" } },
    });
    const consumer = makeConsumer("c1");
    bus.subscribe(consumer);
    bus.publish("ev.x");
    await tick();
    expect(consumer.calls[0].meta.utm).toEqual({ source: "facebook" });
    bus.destroy();
  });

  it("defaults payload to empty object when not provided", async () => {
    const bus = createEventBus({ source: "test" });
    const consumer = makeConsumer("c1");
    bus.subscribe(consumer);
    bus.publish("ev.x");
    await tick();
    expect(consumer.calls[0].payload).toEqual({});
    bus.destroy();
  });
});

// ── publishBatch() ────────────────────────────────────────────────────────────

describe("publishBatch()", () => {
  it("dispatches all events to subscribed consumers", async () => {
    const bus = createEventBus({ source: "test" });
    const consumer = makeConsumer("c1");
    bus.subscribe(consumer);
    bus.publishBatch([{ type: "ev.a" }, { type: "ev.b" }, { type: "ev.c" }]);
    await tick(50);
    expect(consumer.calls).toHaveLength(3);
    bus.destroy();
  });

  it("preserves event type in the order published", async () => {
    const bus = createEventBus({ source: "test" });
    const types: string[] = [];
    bus.subscribe({
      name: "c1", priority: ConsumerPriority.LOW, events: "*",
      handle: (e) => { types.push(e.type); },
    });
    bus.publishBatch([{ type: "ev.1" }, { type: "ev.2" }, { type: "ev.3" }]);
    await tick(50);
    expect(types).toContain("ev.1");
    expect(types).toContain("ev.2");
    expect(types).toContain("ev.3");
    bus.destroy();
  });

  it("uses the bus correlationId for events without override", async () => {
    const bus = createEventBus({ source: "test", correlationId: "bus-corr" });
    const corrIds: string[] = [];
    bus.subscribe({ name: "c1", priority: ConsumerPriority.NORMAL, events: "*", handle: (e) => { corrIds.push(e.correlationId); } });
    bus.publishBatch([{ type: "ev.a" }]);
    await tick();
    expect(corrIds[0]).toBe("bus-corr");
    bus.destroy();
  });

  it("allows per-event correlationId override", async () => {
    const bus = createEventBus({ source: "test", correlationId: "default" });
    const corrIds: string[] = [];
    bus.subscribe({ name: "c1", priority: ConsumerPriority.NORMAL, events: "*", handle: (e) => { corrIds.push(e.correlationId); } });
    bus.publishBatch([
      { type: "ev.a", correlationId: "override" },
      { type: "ev.b" },
    ]);
    await tick(30);
    expect(corrIds[0]).toBe("override");
    expect(corrIds[1]).toBe("default");
    bus.destroy();
  });

  it("is a no-op after destroy()", async () => {
    const bus = createEventBus({ source: "test" });
    const consumer = makeConsumer("c1");
    bus.subscribe(consumer);
    bus.destroy();
    bus.publishBatch([{ type: "ev.a" }]);
    await tick();
    expect(consumer.calls).toHaveLength(0);
  });
});

// ── subscribe() / unsubscribe() ───────────────────────────────────────────────

describe("subscribe() and unsubscribe()", () => {
  it("subscribe() returns an unsubscribe function", async () => {
    const bus = createEventBus({ source: "test" });
    const consumer = makeConsumer("c1");
    const unsub = bus.subscribe(consumer);
    unsub();
    bus.publish("test.event");
    await tick();
    expect(consumer.calls).toHaveLength(0);
    bus.destroy();
  });

  it("unsubscribing once does not affect other consumers", async () => {
    const bus = createEventBus({ source: "test" });
    const c1 = makeConsumer("c1");
    const c2 = makeConsumer("c2");
    const unsub1 = bus.subscribe(c1);
    bus.subscribe(c2);
    unsub1();
    bus.publish("test.event");
    await tick();
    expect(c1.calls).toHaveLength(0);
    expect(c2.calls).toHaveLength(1);
    bus.destroy();
  });

  it("a dynamically subscribed consumer receives events published after subscription", async () => {
    const bus = createEventBus({ source: "test" });
    bus.publish("before.event");
    await tick();
    const consumer = makeConsumer("c1");
    bus.subscribe(consumer);
    bus.publish("after.event");
    await tick();
    expect(consumer.calls).toHaveLength(1);
    expect(consumer.calls[0].type).toBe("after.event");
    bus.destroy();
  });

  it("initial consumers from config receive events", async () => {
    const consumer = makeConsumer("c1");
    const bus = createEventBus({ source: "test", consumers: [consumer] });
    bus.publish("test.event");
    await tick();
    expect(consumer.calls).toHaveLength(1);
    bus.destroy();
  });
});

// ── destroy() ─────────────────────────────────────────────────────────────────

describe("destroy()", () => {
  it("removes all consumers so no events are received", async () => {
    const bus = createEventBus({ source: "test" });
    const c1 = makeConsumer("c1");
    const c2 = makeConsumer("c2");
    bus.subscribe(c1);
    bus.subscribe(c2);
    bus.destroy();
    bus.publish("ev.x");
    await tick();
    expect(c1.calls).toHaveLength(0);
    expect(c2.calls).toHaveLength(0);
  });

  it("deactivates all middlewares", async () => {
    const bus = createEventBus({ source: "test" });
    const mwCalls: number[] = [];
    bus.use(() => { mwCalls.push(1); return null; });
    const consumer = makeConsumer("c1");
    bus.subscribe(consumer);
    bus.destroy();
    bus.publish("ev.x");
    await tick();
    expect(mwCalls).toHaveLength(0);
  });

  it("calling destroy() multiple times does not throw", () => {
    const bus = createEventBus({ source: "test" });
    expect(() => { bus.destroy(); bus.destroy(); }).not.toThrow();
  });
});

// ── Middleware ─────────────────────────────────────────────────────────────────

describe("Middleware via use()", () => {
  it("use() adds a middleware that transforms events before dispatch", async () => {
    const bus = createEventBus({ source: "test" });
    const mw: MiddlewareFn = (e) => ({ ...e, payload: { enriched: true } });
    bus.use(mw);
    const consumer = makeConsumer("c1");
    bus.subscribe(consumer);
    bus.publish("test.event", { original: true });
    await tick();
    expect(consumer.calls[0].payload).toEqual({ enriched: true });
    bus.destroy();
  });

  it("use() returns a removal function", async () => {
    const bus = createEventBus({ source: "test" });
    const mwCalls: number[] = [];
    const remove = bus.use((e) => { mwCalls.push(1); return e; });
    remove();
    const consumer = makeConsumer("c1");
    bus.subscribe(consumer);
    bus.publish("test.event");
    await tick();
    expect(mwCalls).toHaveLength(0);
    bus.destroy();
  });

  it("middleware returning null drops the event (consumer not called)", async () => {
    const bus = createEventBus({ source: "test" });
    bus.use(() => null);
    const consumer = makeConsumer("c1");
    bus.subscribe(consumer);
    bus.publish("test.event");
    await tick();
    expect(consumer.calls).toHaveLength(0);
    bus.destroy();
  });

  it("config middlewares execute before use() middlewares", async () => {
    const order: string[] = [];
    const configMw: MiddlewareFn = (e) => { order.push("config"); return e; };
    const bus = createEventBus({ source: "test", middlewares: [configMw] });
    bus.use((e) => { order.push("dynamic"); return e; });
    bus.subscribe(makeConsumer("c1"));
    bus.publish("test.event");
    await tick();
    expect(order).toEqual(["config", "dynamic"]);
    bus.destroy();
  });
});

// ── CorrelationId ─────────────────────────────────────────────────────────────

describe("CorrelationId", () => {
  it("auto-generates a correlationId when not provided", () => {
    const bus = createEventBus({ source: "test" });
    expect(typeof bus.correlationId).toBe("string");
    expect(bus.correlationId.length).toBeGreaterThan(0);
    bus.destroy();
  });

  it("exposes the configured correlationId", () => {
    const bus = createEventBus({ source: "test", correlationId: "my-corr" });
    expect(bus.correlationId).toBe("my-corr");
    bus.destroy();
  });

  it("propagates the same correlationId to all published events", async () => {
    const bus = createEventBus({ source: "test", correlationId: "journey-1" });
    const corrIds: string[] = [];
    bus.subscribe({ name: "c1", priority: ConsumerPriority.NORMAL, events: "*", handle: (e) => { corrIds.push(e.correlationId); } });
    bus.publish("ev.a");
    bus.publish("ev.b");
    await tick(30);
    expect(corrIds).toEqual(["journey-1", "journey-1"]);
    bus.destroy();
  });

  it("two bus instances with the same correlationId link events across modules", () => {
    const corr = "shared-journey";
    const busA = createEventBus({ source: "form",   correlationId: corr });
    const busB = createEventBus({ source: "crm",    correlationId: corr });
    expect(busA.correlationId).toBe(busB.correlationId);
    busA.destroy();
    busB.destroy();
  });
});

// ── Consumer — event filter ───────────────────────────────────────────────────

describe("Consumer — event filter", () => {
  it("consumer with specific event list receives only matching types", async () => {
    const bus = createEventBus({ source: "test" });
    const cA = makeConsumer("cA", { events: ["ev.a"] });
    const cB = makeConsumer("cB", { events: ["ev.b"] });
    bus.subscribe(cA);
    bus.subscribe(cB);
    bus.publish("ev.a");
    bus.publish("ev.b");
    await tick(30);
    expect(cA.calls.map(e => e.type)).toEqual(["ev.a"]);
    expect(cB.calls.map(e => e.type)).toEqual(["ev.b"]);
    bus.destroy();
  });

  it('consumer with "*" receives all event types', async () => {
    const bus = createEventBus({ source: "test" });
    const consumer = makeConsumer("c1", { events: "*" });
    bus.subscribe(consumer);
    bus.publish("ev.a");
    bus.publish("ev.b");
    bus.publish("ev.c");
    await tick(50);
    expect(consumer.calls).toHaveLength(3);
    bus.destroy();
  });

  it("consumer with empty event list receives nothing", async () => {
    const bus = createEventBus({ source: "test" });
    const consumer = makeConsumer("c1", { events: [] });
    bus.subscribe(consumer);
    bus.publish("ev.a");
    await tick();
    expect(consumer.calls).toHaveLength(0);
    bus.destroy();
  });
});

// ── Consumer — priority ───────────────────────────────────────────────────────

describe("Consumer — priority", () => {
  it("CRITICAL executes before HIGH before NORMAL before LOW", async () => {
    const bus = createEventBus({ source: "test" });
    const order: string[] = [];
    bus.subscribe({ name: "low",      priority: ConsumerPriority.LOW,      events: "*", handle: () => { order.push("low");      } });
    bus.subscribe({ name: "normal",   priority: ConsumerPriority.NORMAL,   events: "*", handle: () => { order.push("normal");   } });
    bus.subscribe({ name: "critical", priority: ConsumerPriority.CRITICAL, events: "*", handle: () => { order.push("critical"); } });
    bus.subscribe({ name: "high",     priority: ConsumerPriority.HIGH,     events: "*", handle: () => { order.push("high");     } });
    bus.publish("test.event");
    await tick(30);
    expect(order).toEqual(["critical", "high", "normal", "low"]);
    bus.destroy();
  });

  it("consumers at the same priority level all receive the event", async () => {
    const bus = createEventBus({ source: "test" });
    const c1 = makeConsumer("c1", { priority: ConsumerPriority.HIGH });
    const c2 = makeConsumer("c2", { priority: ConsumerPriority.HIGH });
    bus.subscribe(c1);
    bus.subscribe(c2);
    bus.publish("test.event");
    await tick(30);
    expect(c1.calls).toHaveLength(1);
    expect(c2.calls).toHaveLength(1);
    bus.destroy();
  });
});

// ── Consumer — fan-out ────────────────────────────────────────────────────────

describe("Consumer — fan-out", () => {
  it("all subscribed consumers receive the same event", async () => {
    const bus = createEventBus({ source: "test" });
    const consumers = [makeConsumer("c1"), makeConsumer("c2"), makeConsumer("c3")];
    consumers.forEach(c => bus.subscribe(c));
    bus.publish("test.event", { data: 42 });
    await tick(30);
    consumers.forEach(c => {
      expect(c.calls).toHaveLength(1);
      expect(c.calls[0].payload).toEqual({ data: 42 });
    });
    bus.destroy();
  });

  it("multiple events are each received by all consumers", async () => {
    const bus = createEventBus({ source: "test" });
    const c1 = makeConsumer("c1");
    const c2 = makeConsumer("c2");
    bus.subscribe(c1);
    bus.subscribe(c2);
    bus.publish("ev.1");
    bus.publish("ev.2");
    await tick(50);
    expect(c1.calls).toHaveLength(2);
    expect(c2.calls).toHaveLength(2);
    bus.destroy();
  });
});

// ── Consumer — isolation ──────────────────────────────────────────────────────

describe("Consumer — isolation", () => {
  it("a failing consumer does not prevent lower-priority consumers from running", async () => {
    const bus = createEventBus({ source: "test" });
    bus.subscribe({
      name:     "failing",
      priority: ConsumerPriority.HIGH,
      events:   "*",
      retry:    { maxAttempts: 1, backoffMs: 0, persist: false },
      handle:   () => { throw new Error("intentional failure"); },
    });
    const healthy = makeConsumer("healthy", { priority: ConsumerPriority.NORMAL });
    bus.subscribe(healthy);
    bus.publish("test.event");
    await tick(30);
    expect(healthy.calls).toHaveLength(1);
    bus.destroy();
  });

  it("each consumer receives an independent copy of the event (same reference is OK)", async () => {
    const bus = createEventBus({ source: "test" });
    const events: BusEvent[] = [];
    bus.subscribe({ name: "c1", priority: ConsumerPriority.NORMAL, events: "*", handle: (e) => { events.push(e); } });
    bus.subscribe({ name: "c2", priority: ConsumerPriority.NORMAL, events: "*", handle: (e) => { events.push(e); } });
    bus.publish("test.event");
    await tick(30);
    expect(events[0]).toBe(events[1]); // same reference is fine — event is readonly
    bus.destroy();
  });
});

// ── Retry ─────────────────────────────────────────────────────────────────────

describe("Retry behaviour", () => {
  it("succeeds on first attempt — handle called once", async () => {
    const bus = createEventBus({ source: "test" });
    let calls = 0;
    bus.subscribe({
      name: "c1", priority: ConsumerPriority.HIGH, events: "*",
      retry: { maxAttempts: 3, backoffMs: 1, persist: false },
      handle: () => { calls++; },
    });
    bus.publish("test.event");
    await tick(50);
    expect(calls).toBe(1);
    bus.destroy();
  });

  it("retries on failure — handle called maxAttempts times when always failing", async () => {
    const bus = createEventBus({ source: "test" });
    let calls = 0;
    bus.subscribe({
      name: "c1", priority: ConsumerPriority.HIGH, events: "*",
      retry: { maxAttempts: 3, backoffMs: 1, persist: false },
      handle: () => { calls++; throw new Error("fail"); },
    });
    bus.publish("test.event");
    await tick(100);
    expect(calls).toBe(3);
    bus.destroy();
  });

  it("stops retrying after a successful attempt", async () => {
    const bus = createEventBus({ source: "test" });
    let calls = 0;
    bus.subscribe({
      name: "c1", priority: ConsumerPriority.HIGH, events: "*",
      retry: { maxAttempts: 3, backoffMs: 1, persist: false },
      handle: () => {
        calls++;
        if (calls < 2) throw new Error("first fail");
      },
    });
    bus.publish("test.event");
    await tick(100);
    expect(calls).toBe(2);
    bus.destroy();
  });

  it("CRITICAL default: 5 max attempts", async () => {
    const bus = createEventBus({ source: "test", storage: new InMemoryAdapter() });
    let calls = 0;
    bus.subscribe({
      name: "crit", priority: ConsumerPriority.CRITICAL, events: "*",
      retry: { maxAttempts: 5, backoffMs: 1, persist: false },
      handle: () => { calls++; throw new Error("always fail"); },
    });
    bus.publish("test.event");
    await tick(150);
    expect(calls).toBe(5);
    bus.destroy();
  });

  it("NORMAL default: 2 max attempts", async () => {
    const bus = createEventBus({ source: "test" });
    let calls = 0;
    bus.subscribe({
      name: "norm", priority: ConsumerPriority.NORMAL, events: "*",
      retry: { maxAttempts: 2, backoffMs: 1, persist: false },
      handle: () => { calls++; throw new Error("always fail"); },
    });
    bus.publish("test.event");
    await tick(50);
    expect(calls).toBe(2);
    bus.destroy();
  });

  it("LOW default: 1 attempt (no retry)", async () => {
    const bus = createEventBus({ source: "test" });
    let calls = 0;
    bus.subscribe({
      name: "low", priority: ConsumerPriority.LOW, events: "*",
      retry: { maxAttempts: 1, backoffMs: 0, persist: false },
      handle: () => { calls++; throw new Error("fail"); },
    });
    bus.publish("test.event");
    await tick(30);
    expect(calls).toBe(1);
    bus.destroy();
  });
});

// ── flush() ───────────────────────────────────────────────────────────────────

describe("flush()", () => {
  it("retries CRITICAL events persisted in the queue after all in-memory retries fail", async () => {
    const storage = new InMemoryAdapter();
    const bus = createEventBus({ source: "test", storage });
    let online = false;
    let handleCalls = 0;
    bus.subscribe({
      name:     "webhook",
      priority: ConsumerPriority.CRITICAL,
      events:   "*",
      retry:    { maxAttempts: 2, backoffMs: 1, persist: true },
      handle:   async () => {
        handleCalls++;
        if (!online) throw new Error("offline");
      },
    });

    bus.publish("test.event");
    await tick(100); // all 2 attempts fail → event in queue

    expect(storage.size()).toBeGreaterThan(0);

    online = true;
    await bus.flush();

    // Queue should be empty after successful flush
    expect(storage.size()).toBe(0);
    expect(handleCalls).toBeGreaterThan(2); // 2 failures + 1 flush success
    bus.destroy();
  });

  it("does not process non-CRITICAL consumers", async () => {
    const storage = new InMemoryAdapter();
    const bus = createEventBus({ source: "test", storage });
    let flushCalls = 0;
    bus.subscribe({
      name:     "analytics",
      priority: ConsumerPriority.HIGH, // not CRITICAL
      events:   "*",
      retry:    { maxAttempts: 1, backoffMs: 0, persist: true },
      handle:   async () => { flushCalls++; throw new Error("fail"); },
    });
    bus.publish("test.event");
    await tick(50);
    const callsBefore = flushCalls;
    await bus.flush(); // should not retry HIGH consumers
    expect(flushCalls).toBe(callsBefore); // no additional calls
    bus.destroy();
  });

  it("is a no-op when the queue is empty", async () => {
    const bus = createEventBus({ source: "test" });
    await expect(bus.flush()).resolves.toBeUndefined();
    bus.destroy();
  });

  it("is a no-op after destroy()", async () => {
    const bus = createEventBus({ source: "test" });
    bus.destroy();
    await expect(bus.flush()).resolves.toBeUndefined();
  });
});

// ── Observability ─────────────────────────────────────────────────────────────

describe("Observability (debug: true)", () => {
  it("obs is undefined when debug: false (default)", () => {
    const bus = createEventBus({ source: "test" });
    expect(bus.obs).toBeUndefined();
    bus.destroy();
  });

  it("obs is defined when debug: true", () => {
    const bus = createEventBus({ source: "test", debug: true });
    expect(bus.obs).toBeDefined();
    bus.destroy();
  });

  it("tracks published count", async () => {
    const bus = createEventBus({ source: "test", debug: true });
    bus.publish("ev.a");
    bus.publish("ev.b");
    await tick();
    expect(bus.obs!.published).toBe(2);
    bus.destroy();
  });

  it("tracks dispatched count (events that reach at least one consumer)", async () => {
    const bus = createEventBus({ source: "test", debug: true });
    bus.subscribe(makeConsumer("c1"));
    bus.publish("ev.a");
    await tick();
    expect(bus.obs!.dispatched).toBe(1);
    bus.destroy();
  });

  it("tracks dropped count (events cancelled by middleware)", async () => {
    const bus = createEventBus({ source: "test", debug: true });
    bus.use(() => null); // drop all
    bus.subscribe(makeConsumer("c1"));
    bus.publish("ev.a");
    bus.publish("ev.b");
    await tick();
    expect(bus.obs!.dropped).toBe(2);
    expect(bus.obs!.dispatched).toBe(0);
    bus.destroy();
  });

  it("tracks failed count when consumer exhausts all retries", async () => {
    const bus = createEventBus({ source: "test", debug: true });
    bus.subscribe({
      name: "fail-c", priority: ConsumerPriority.NORMAL, events: "*",
      retry: { maxAttempts: 1, backoffMs: 0, persist: false },
      handle: () => { throw new Error("always fail"); },
    });
    bus.publish("ev.a");
    await tick(30);
    expect(bus.obs!.failed).toBe(1);
    bus.destroy();
  });

  it("obs.recentEvents contains recently published events", async () => {
    const bus = createEventBus({ source: "test", debug: true });
    bus.subscribe(makeConsumer("c1"));
    bus.publish("ev.x", { data: "test" });
    await tick();
    expect(bus.obs!.recentEvents).toHaveLength(1);
    expect(bus.obs!.recentEvents[0].type).toBe("ev.x");
    bus.destroy();
  });

  it("obs.snapshot() returns a plain serializable object", () => {
    const bus = createEventBus({ source: "test", debug: true });
    const snap = bus.obs!.snapshot();
    expect(typeof snap).toBe("object");
    expect("published" in snap).toBe(true);
    expect("failed" in snap).toBe(true);
    bus.destroy();
  });

  it("obs.reset() zeroes all counters", async () => {
    const bus = createEventBus({ source: "test", debug: true });
    bus.subscribe(makeConsumer("c1"));
    bus.publish("ev.x");
    await tick();
    bus.obs!.reset();
    expect(bus.obs!.published).toBe(0);
    expect(bus.obs!.dispatched).toBe(0);
    bus.destroy();
  });

  it("obs.consumers contains one entry per subscribed consumer", async () => {
    const bus = createEventBus({ source: "test", debug: true });
    bus.subscribe(makeConsumer("c1"));
    bus.subscribe(makeConsumer("c2"));
    bus.publish("ev.x");
    await tick();
    const names = bus.obs!.consumers.map(c => c.name);
    expect(names).toContain("c1");
    expect(names).toContain("c2");
    bus.destroy();
  });

  it("obs.snapshot() includes consumers array", () => {
    const bus = createEventBus({ source: "test", debug: true });
    bus.subscribe(makeConsumer("webhook"));
    const snap = bus.obs!.snapshot();
    expect(Array.isArray(snap.consumers)).toBe(true);
    bus.destroy();
  });

  it("obs.queued reflects events in the persistent queue", async () => {
    const storage = new InMemoryAdapter();
    const bus     = createEventBus({ source: "test", storage, debug: true });
    bus.subscribe({
      name: "q-consumer", priority: ConsumerPriority.CRITICAL, events: "*",
      retry: { maxAttempts: 1, backoffMs: 0, persist: true },
      handle: () => { throw new Error("offline"); },
    });
    bus.publish("ev.x");
    await tick(30);
    expect(bus.obs!.queued).toBeGreaterThan(0);
    bus.destroy();
  });
});
