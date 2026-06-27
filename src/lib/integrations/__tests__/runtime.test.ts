import { describe, it, expect } from "vitest";
import { getIntegrationRuntime, HistoryAwareObserver } from "../runtime";

describe("getIntegrationRuntime()", () => {
  it("returns a runtime object with all required properties", () => {
    const runtime = getIntegrationRuntime();
    expect(runtime.observer).toBeDefined();
    expect(runtime.dlq).toBeDefined();
    expect(runtime.registry).toBeDefined();
    expect(runtime.circuitBreakers).toBeDefined();
    expect(runtime.rateLimiter).toBeDefined();
    expect(runtime.secretProvider).toBeDefined();
    expect(runtime.queue).toBeDefined();
    expect(runtime.pipeline).toBeDefined();
  });

  it("returns the same singleton on repeated calls", () => {
    const r1 = getIntegrationRuntime();
    const r2 = getIntegrationRuntime();
    expect(r1).toBe(r2);
  });

  it("registry has all 4 adapters registered", () => {
    const { registry } = getIntegrationRuntime();
    expect(registry.has("meta-pixel")).toBe(true);
    expect(registry.has("ga4")).toBe(true);
    expect(registry.has("webhook")).toBe(true);
    expect(registry.has("crm")).toBe(true);
  });

  it("pipeline is functional", () => {
    const { pipeline } = getIntegrationRuntime();
    const result = pipeline.run(
      { id: "e1", correlationId: "c1", type: "form.started", formSlug: "test", sessionToken: "tok", timestamp: Date.now(), payload: {}, meta: {}, version: 1 },
      { formSlug: "test", correlationId: "c1" },
    );
    expect(result.transformed).toBe(true);
    expect(result.transforms.length).toBeGreaterThan(0);
  });
});

describe("HistoryAwareObserver", () => {
  it("getHistory() returns empty array initially", () => {
    const obs = new HistoryAwareObserver();
    expect(obs.getHistory()).toEqual([]);
  });

  it("pushHistory() records an entry visible via getHistory()", () => {
    const obs = new HistoryAwareObserver();
    obs.pushHistory("webhook", "form.started", {
      ok: true, status: 200, durationMs: 50, attempt: 1, correlationId: "corr-1",
    });
    const hist = obs.getHistory();
    expect(hist).toHaveLength(1);
    expect(hist[0].adapterName).toBe("webhook");
    expect(hist[0].eventType).toBe("form.started");
    expect(hist[0].ok).toBe(true);
  });

  it("filters history by adapterName", () => {
    const obs = new HistoryAwareObserver();
    obs.pushHistory("webhook",    "form.started",   { ok: true,  durationMs: 10, attempt: 1, correlationId: "c1" });
    obs.pushHistory("meta-pixel", "form.completed", { ok: false, durationMs: 20, attempt: 1, correlationId: "c2", error: "err" });
    expect(obs.getHistory("webhook")).toHaveLength(1);
    expect(obs.getHistory("meta-pixel")).toHaveLength(1);
    expect(obs.getHistory()).toHaveLength(2);
  });

  it("also updates parent observer stats via pushHistory()", () => {
    const obs = new HistoryAwareObserver();
    obs.pushHistory("crm", "form.completed", { ok: true, durationMs: 30, attempt: 1, correlationId: "c" });
    expect(obs.snapshot("crm").successes).toBe(1);
    expect(obs.snapshot("crm").deliveries).toBe(1);
  });

  it("clearHistory() empties the history", () => {
    const obs = new HistoryAwareObserver();
    obs.pushHistory("webhook", "form.started", { ok: true, durationMs: 5, attempt: 1, correlationId: "c" });
    obs.clearHistory();
    expect(obs.getHistory()).toHaveLength(0);
  });

  it("caps history at 200 entries", () => {
    const obs = new HistoryAwareObserver();
    for (let i = 0; i < 210; i++) {
      obs.pushHistory("webhook", "form.started", { ok: true, durationMs: 1, attempt: 1, correlationId: `c${i}` });
    }
    expect(obs.getHistory().length).toBeLessThanOrEqual(200);
  });
});
