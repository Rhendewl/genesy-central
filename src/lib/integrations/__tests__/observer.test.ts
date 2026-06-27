import { describe, it, expect } from "vitest";
import { IntegrationObserver } from "../observer";
import type { DeliveryResult } from "../types";

function makeResult(ok: boolean, ms = 100, status?: number): DeliveryResult {
  return {
    ok, durationMs: ms, attempt: 1, correlationId: "corr",
    ...(status ? { status } : {}),
    ...(ok ? {} : { error: "err" }),
  };
}

describe("IntegrationObserver", () => {
  it("starts with zero metrics for unknown adapter", () => {
    const obs = new IntegrationObserver();
    const snap = obs.snapshot("meta-pixel");
    expect(snap.deliveries).toBe(0);
    expect(snap.successes).toBe(0);
    expect(snap.failures).toBe(0);
    expect(snap.avgLatencyMs).toBe(0);
    expect(snap.p95LatencyMs).toBe(0);
  });

  it("records successful delivery", () => {
    const obs = new IntegrationObserver();
    obs.recordDelivery("meta-pixel", makeResult(true, 50));
    const snap = obs.snapshot("meta-pixel");
    expect(snap.deliveries).toBe(1);
    expect(snap.successes).toBe(1);
    expect(snap.failures).toBe(0);
    expect(snap.avgLatencyMs).toBe(50);
  });

  it("records failed delivery", () => {
    const obs = new IntegrationObserver();
    obs.recordDelivery("ga4", makeResult(false, 200));
    const snap = obs.snapshot("ga4");
    expect(snap.failures).toBe(1);
    expect(snap.successes).toBe(0);
  });

  it("computes average latency across multiple deliveries", () => {
    const obs = new IntegrationObserver();
    obs.recordDelivery("webhook", makeResult(true, 100));
    obs.recordDelivery("webhook", makeResult(true, 200));
    obs.recordDelivery("webhook", makeResult(true, 300));
    expect(obs.snapshot("webhook").avgLatencyMs).toBe(200);
  });

  it("computes p95 latency", () => {
    const obs = new IntegrationObserver();
    // 10 records: 5 × 10ms + 5 × 1000ms → sorted = [10,10,10,10,10,1000,1000,1000,1000,1000]
    // p95 index = ceil(10 × 0.95) - 1 = 10 - 1 = 9 → sorted[9] = 1000
    for (let i = 0; i < 5; i++)  obs.recordDelivery("x", makeResult(true, 10));
    for (let i = 0; i < 5; i++)  obs.recordDelivery("x", makeResult(true, 1000));
    const p95 = obs.snapshot("x").p95LatencyMs;
    expect(p95).toBe(1000);
  });

  it("records retries", () => {
    const obs = new IntegrationObserver();
    obs.recordRetry("webhook");
    obs.recordRetry("webhook");
    expect(obs.snapshot("webhook").retries).toBe(2);
  });

  it("records dead letters", () => {
    const obs = new IntegrationObserver();
    obs.recordDeadLetter("crm");
    expect(obs.snapshot("crm").deadLettered).toBe(1);
  });

  it("records circuit breaks", () => {
    const obs = new IntegrationObserver();
    obs.recordCircuitBreak("meta-pixel");
    expect(obs.snapshot("meta-pixel").circuitBreaks).toBe(1);
  });

  it("records rate limiting", () => {
    const obs = new IntegrationObserver();
    obs.recordRateLimit("ga4");
    obs.recordRateLimit("ga4");
    expect(obs.snapshot("ga4").rateLimited).toBe(2);
  });

  it("setQueueDepth() updates depth in snapshot", () => {
    const obs = new IntegrationObserver();
    obs.setQueueDepth("webhook", 42);
    expect(obs.snapshot("webhook").queueDepth).toBe(42);
  });

  it("snapshots() returns all recorded adapters", () => {
    const obs = new IntegrationObserver();
    obs.recordDelivery("a", makeResult(true));
    obs.recordDelivery("b", makeResult(false));
    const all = obs.snapshots();
    expect(all.map(s => s.adapterName).sort()).toEqual(["a", "b"]);
  });

  it("reset(adapterName) clears only that adapter", () => {
    const obs = new IntegrationObserver();
    obs.recordDelivery("a", makeResult(true));
    obs.recordDelivery("b", makeResult(true));
    obs.reset("a");
    expect(obs.snapshot("a").deliveries).toBe(0);
    expect(obs.snapshot("b").deliveries).toBe(1);
  });

  it("exportMetrics() returns JSON-serializable map of all snapshots", () => {
    const obs = new IntegrationObserver();
    obs.recordDelivery("a", makeResult(true, 100));
    obs.recordDelivery("b", makeResult(false, 200));
    const exported = obs.exportMetrics();
    expect(Object.keys(exported).sort()).toEqual(["a", "b"]);
    expect(exported["a"].successes).toBe(1);
    expect(exported["b"].failures).toBe(1);
    expect(JSON.stringify(exported)).not.toThrow;
  });

  it("exportMetrics() returns empty object when no deliveries recorded", () => {
    const obs = new IntegrationObserver();
    expect(obs.exportMetrics()).toEqual({});
  });

  it("reset() with no args clears all", () => {
    const obs = new IntegrationObserver();
    obs.recordDelivery("a", makeResult(true));
    obs.recordDelivery("b", makeResult(true));
    obs.reset();
    expect(obs.snapshots()).toHaveLength(0);
  });
});
