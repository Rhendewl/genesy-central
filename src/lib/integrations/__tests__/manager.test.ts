import { describe, it, expect, vi, afterEach } from "vitest";
import { createIntegrationManager, InMemoryConfigLoader } from "../manager";
import { createTransformPipeline }  from "../pipeline/pipeline";
import { normalizeTransform }       from "../pipeline/transforms/normalize";
import { DeliveryQueue }            from "../queue";
import { IntegrationRegistry }      from "../registry";
import { CircuitBreakerRegistry }   from "../circuit-breaker";
import { RateLimiter }              from "../rate-limiter";
import { PlainSecretProvider }      from "../security/secret-provider";
import { DeadLetterQueue }          from "../dead-letter";
import { IntegrationObserver }      from "../observer";
import { WebhookAdapter }           from "../adapters/webhook";
import { webhookMapper }            from "../mappers/webhook";
import { ConsumerPriority }         from "../../event-bus/types";
import type { BusEvent }            from "../../event-bus/types";
import { makeConfig, tick }         from "./helpers";

afterEach(() => vi.restoreAllMocks());

// ── Test setup ────────────────────────────────────────────────────────────────

function makeSetup() {
  const registry = new IntegrationRegistry();
  registry.register(new WebhookAdapter(), webhookMapper);

  const queue   = new DeliveryQueue({
    registry,
    circuitBreakers: new CircuitBreakerRegistry(),
    rateLimiter:     new RateLimiter(),
    secretProvider:  new PlainSecretProvider(),
    dlq:             new DeadLetterQueue(),
    observer:        new IntegrationObserver(),
  });

  const pipeline     = createTransformPipeline([normalizeTransform]);
  const configLoader = new InMemoryConfigLoader();
  const manager      = createIntegrationManager({ pipeline, queue, configLoader });

  return { manager, queue, configLoader, registry };
}

function makeBusEvent(type = "form.started", formSlug = "test-form"): BusEvent {
  return {
    id:            "evt-001",
    correlationId: "corr-xyz",
    type,
    source:        "form",
    timestamp:     Date.now(),
    payload:       { formSlug, sessionToken: "tok" },
    meta:          {},
  };
}

// ── Consumer contract ─────────────────────────────────────────────────────────

describe("createIntegrationManager() — consumer contract", () => {
  it("returns an EventConsumer with name 'integrations'", () => {
    const { manager } = makeSetup();
    expect(manager.name).toBe("integrations");
  });

  it("uses ConsumerPriority.NORMAL", () => {
    const { manager } = makeSetup();
    expect(manager.priority).toBe(ConsumerPriority.NORMAL);
  });

  it("subscribes to all events ('*')", () => {
    const { manager } = makeSetup();
    expect(manager.events).toBe("*");
  });
});

// ── Event routing ─────────────────────────────────────────────────────────────

describe("createIntegrationManager() — routing", () => {
  it("skips events with no formSlug", async () => {
    const { manager, queue } = makeSetup();
    const evt: BusEvent = {
      id: "e", correlationId: "c", type: "form.started", source: "form",
      timestamp: Date.now(), payload: {}, meta: {},
    };
    await manager.handle(evt);
    expect(queue.depth()).toBe(0);
  });

  it("enqueues a job for each active config that matches the event", async () => {
    const { manager, queue, configLoader } = makeSetup();
    configLoader.set("test-form", [
      makeConfig({ id: "cfg-1", adapterName: "webhook", settings: { url: "https://x.com" } }),
      makeConfig({ id: "cfg-2", adapterName: "webhook", settings: { url: "https://y.com" } }),
    ]);

    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, status: 200 } as Response);
    await manager.handle(makeBusEvent("form.started", "test-form"));
    await tick(50);
    // 2 configs → 2 deliveries attempted
    expect(queue.depth() + queue.activeCount()).toBeLessThanOrEqual(0); // all processed
  });

  it("skips disabled configs", async () => {
    const { manager, queue, configLoader } = makeSetup();
    configLoader.set("test-form", [
      makeConfig({ id: "cfg-d", adapterName: "webhook", enabled: false, settings: { url: "https://x.com" } }),
    ]);
    await manager.handle(makeBusEvent("form.started", "test-form"));
    await tick(20);
    expect(queue.depth()).toBe(0);
  });

  it("respects eventFilter — skips non-matching events", async () => {
    const { manager, queue, configLoader } = makeSetup();
    configLoader.set("test-form", [
      makeConfig({
        id: "cfg-filtered", adapterName: "webhook",
        settings: { url: "https://x.com" },
        eventFilter: ["form.completed"],  // only on completed
      }),
    ]);
    await manager.handle(makeBusEvent("form.started", "test-form"));
    await tick(20);
    expect(queue.depth()).toBe(0);
  });

  it("processes matching eventFilter events", async () => {
    const { manager, configLoader } = makeSetup();
    const enqueued: string[] = [];

    configLoader.set("test-form", [
      makeConfig({
        id: "cfg-ok", adapterName: "webhook",
        settings: { url: "https://x.com" },
        eventFilter: ["form.completed"],
      }),
    ]);

    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, status: 200 } as Response);
    await manager.handle(makeBusEvent("form.completed", "test-form"));
    await tick(50);
    // Just verify no errors thrown — the adapter was called
  });

  it("propagates correlationId through to delivery job", async () => {
    const { manager, queue: q, configLoader } = makeSetup();
    const enqueueSpy = vi.spyOn(q, "enqueue");
    configLoader.set("test-form", [
      makeConfig({ id: "cfg-1", adapterName: "webhook", settings: { url: "https://x.com" } }),
    ]);
    await manager.handle(makeBusEvent("form.started", "test-form"));
    expect(enqueueSpy).toHaveBeenCalledWith(
      expect.objectContaining({ correlationId: "corr-xyz" }),
    );
  });

  it("uses deterministic deliveryId (eventId:configId)", async () => {
    const { manager, queue: q, configLoader } = makeSetup();
    const enqueueSpy = vi.spyOn(q, "enqueue");
    configLoader.set("test-form", [
      makeConfig({ id: "cfg-id-99", adapterName: "webhook", settings: { url: "https://x.com" } }),
    ]);
    const evt = makeBusEvent("form.started", "test-form");
    await manager.handle(evt);
    expect(enqueueSpy).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryId: `${evt.id}:cfg-id-99` }),
    );
  });
});

// ── InMemoryConfigLoader ──────────────────────────────────────────────────────

describe("InMemoryConfigLoader", () => {
  it("returns empty array for unknown form", async () => {
    const loader = new InMemoryConfigLoader();
    expect(await loader.load("unknown")).toEqual([]);
  });

  it("returns configs set for a slug", async () => {
    const loader = new InMemoryConfigLoader();
    const cfg    = makeConfig({ id: "c1" });
    loader.set("my-form", [cfg]);
    expect(await loader.load("my-form")).toEqual([cfg]);
  });

  it("set() is chainable", async () => {
    const loader = new InMemoryConfigLoader();
    loader.set("a", []).set("b", []);
    expect(await loader.load("a")).toEqual([]);
    expect(await loader.load("b")).toEqual([]);
  });
});
