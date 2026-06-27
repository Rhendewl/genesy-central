import { describe, it, expect, vi } from "vitest";
import {
  applyMiddlewares,
  stripNullsMiddleware,
  urlEnrichMiddleware,
  debugLogMiddleware,
} from "../middleware";
import type { BusEvent, MiddlewareFn } from "../types";

// ── Helper ─────────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<BusEvent> = {}): BusEvent {
  return {
    id:            "evt-1",
    type:          "test.event",
    correlationId: "corr-1",
    source:        "test",
    timestamp:     1_000_000,
    payload:       {},
    meta:          {},
    ...overrides,
  };
}

// ── applyMiddlewares ───────────────────────────────────────────────────────────

describe("applyMiddlewares()", () => {
  it("returns the original event when the middleware list is empty", () => {
    const event = makeEvent();
    expect(applyMiddlewares(event, [])).toBe(event);
  });

  it("passes the event through a single no-op middleware", () => {
    const event   = makeEvent();
    const passThru: MiddlewareFn = (e) => e;
    const result  = applyMiddlewares(event, [passThru]);
    expect(result).toBe(event);
  });

  it("applies a single transforming middleware", () => {
    const event  = makeEvent({ payload: { x: 1 } });
    const mw: MiddlewareFn = (e) => ({ ...e, payload: { x: 99 } });
    const result = applyMiddlewares(event, [mw])!;
    expect((result.payload as { x: number }).x).toBe(99);
  });

  it("executes middlewares in registration order (1 → 2 → 3)", () => {
    const order: number[] = [];
    const mw = (n: number): MiddlewareFn => (e) => { order.push(n); return e; };
    applyMiddlewares(makeEvent(), [mw(1), mw(2), mw(3)]);
    expect(order).toEqual([1, 2, 3]);
  });

  it("drops the event when a middleware returns null", () => {
    const drop: MiddlewareFn = () => null;
    expect(applyMiddlewares(makeEvent(), [drop])).toBeNull();
  });

  it("stops the pipeline at the first null (subsequent middlewares not called)", () => {
    const called: number[] = [];
    const mw1: MiddlewareFn = (e) => { called.push(1); return e; };
    const mw2: MiddlewareFn = ()  => { called.push(2); return null; };
    const mw3: MiddlewareFn = (e) => { called.push(3); return e; };
    applyMiddlewares(makeEvent(), [mw1, mw2, mw3]);
    expect(called).toEqual([1, 2]);
  });

  it("chained enrichment accumulates meta from multiple middlewares", () => {
    const mw1: MiddlewareFn = (e) => ({ ...e, meta: { ...e.meta, a: 1 } });
    const mw2: MiddlewareFn = (e) => ({ ...e, meta: { ...e.meta, b: 2 } });
    const result = applyMiddlewares(makeEvent(), [mw1, mw2])!;
    expect(result.meta).toMatchObject({ a: 1, b: 2 });
  });

  it("each middleware receives the output of the previous one", () => {
    const mw1: MiddlewareFn = (e) => ({ ...e, payload: { step: 1 } });
    const mw2: MiddlewareFn = (e) => ({
      ...e,
      payload: { ...(e.payload as object), step: 2 },
    });
    const result = applyMiddlewares(makeEvent(), [mw1, mw2])!;
    expect(result.payload).toEqual({ step: 2 });
  });

  it("a null from the last middleware still drops the event", () => {
    const drop: MiddlewareFn = () => null;
    const keep: MiddlewareFn = (e) => e;
    expect(applyMiddlewares(makeEvent(), [keep, drop])).toBeNull();
  });
});

// ── stripNullsMiddleware ───────────────────────────────────────────────────────

describe("stripNullsMiddleware", () => {
  it("removes null values from an object payload", () => {
    const event  = makeEvent({ payload: { a: 1, b: null } });
    const result = stripNullsMiddleware(event)!;
    expect(result.payload).toEqual({ a: 1 });
    expect((result.payload as Record<string, unknown>).b).toBeUndefined();
  });

  it("removes undefined values from an object payload", () => {
    const event  = makeEvent({ payload: { a: 1, b: undefined } });
    const result = stripNullsMiddleware(event)!;
    expect(result.payload).toEqual({ a: 1 });
  });

  it("preserves falsy-but-valid values: 0, false, empty string", () => {
    const event  = makeEvent({ payload: { zero: 0, bool: false, empty: "" } });
    const result = stripNullsMiddleware(event)!;
    expect(result.payload).toEqual({ zero: 0, bool: false, empty: "" });
  });

  it("leaves non-object payloads unchanged (string)", () => {
    const event  = makeEvent({ payload: "raw-string" });
    const result = stripNullsMiddleware(event)!;
    expect(result.payload).toBe("raw-string");
  });

  it("leaves non-object payloads unchanged (number)", () => {
    const event  = makeEvent({ payload: 42 });
    const result = stripNullsMiddleware(event)!;
    expect(result.payload).toBe(42);
  });

  it("leaves a null payload unchanged", () => {
    const event  = makeEvent({ payload: null });
    const result = stripNullsMiddleware(event)!;
    expect(result.payload).toBeNull();
  });

  it("does not mutate the original event", () => {
    const original = { a: 1, b: null } as Record<string, unknown>;
    const event    = makeEvent({ payload: original });
    stripNullsMiddleware(event);
    expect(original.b).toBeNull(); // original untouched
  });
});

// ── urlEnrichMiddleware ───────────────────────────────────────────────────────

describe("urlEnrichMiddleware", () => {
  it("adds url to event meta in browser environment (jsdom)", () => {
    const event  = makeEvent({ meta: {} });
    const result = urlEnrichMiddleware(event)!;
    // jsdom provides window.location.href
    expect(typeof result.meta.url).toBe("string");
  });

  it("does not modify the original meta object", () => {
    const meta  = {} as Record<string, unknown>;
    const event = makeEvent({ meta });
    urlEnrichMiddleware(event);
    expect(Object.keys(meta)).toHaveLength(0);
  });

  it("preserves existing meta fields alongside new url", () => {
    const event  = makeEvent({ meta: { customField: "value" } });
    const result = urlEnrichMiddleware(event)!;
    expect((result.meta as Record<string, unknown>).customField).toBe("value");
    expect(result.meta.url).toBeDefined();
  });
});

// ── debugLogMiddleware ────────────────────────────────────────────────────────

describe("debugLogMiddleware", () => {
  it("passes the event through without modification", () => {
    const consoleSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const event  = makeEvent({ payload: { x: 1 } });
    const result = debugLogMiddleware(event)!;
    expect(result.payload).toEqual({ x: 1 });
    consoleSpy.mockRestore();
  });

  it("calls console.debug with event info", () => {
    const consoleSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    debugLogMiddleware(makeEvent({ type: "some.event", source: "mymod" }));
    expect(consoleSpy).toHaveBeenCalledOnce();
    const callArg = consoleSpy.mock.calls[0][0] as string;
    expect(callArg).toContain("some.event");
    consoleSpy.mockRestore();
  });
});
