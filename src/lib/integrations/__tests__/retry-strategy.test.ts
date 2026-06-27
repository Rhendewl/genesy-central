import { describe, it, expect } from "vitest";
import { exponentialRetryStrategy } from "../retry-strategy";
import type { RetryPolicy } from "../types";

const basePolicy: RetryPolicy = {
  maxAttempts:       3,
  initialDelayMs:    1_000,
  maxDelayMs:        30_000,
  backoffFactor:     2,
  jitter:            false,
  timeoutMs:         10_000,
  retryableStatuses: [500],
};

describe("exponentialRetryStrategy", () => {
  it("has name 'exponential'", () => {
    expect(exponentialRetryStrategy.name).toBe("exponential");
  });

  it("returns 1000ms for attempt 1 (no jitter)", () => {
    expect(exponentialRetryStrategy.computeDelay(basePolicy, 1)).toBe(1_000);
  });

  it("returns 2000ms for attempt 2 (no jitter)", () => {
    expect(exponentialRetryStrategy.computeDelay(basePolicy, 2)).toBe(2_000);
  });

  it("returns 4000ms for attempt 3 (no jitter)", () => {
    expect(exponentialRetryStrategy.computeDelay(basePolicy, 3)).toBe(4_000);
  });

  it("caps at maxDelayMs", () => {
    const policy = { ...basePolicy, maxDelayMs: 1_500 };
    expect(exponentialRetryStrategy.computeDelay(policy, 3)).toBe(1_500);
  });

  it("returns a value in [0, base] when jitter is enabled", () => {
    const policy = { ...basePolicy, jitter: true };
    const delay  = exponentialRetryStrategy.computeDelay(policy, 1);
    expect(delay).toBeGreaterThanOrEqual(0);
    expect(delay).toBeLessThanOrEqual(1_000);
  });

  it("implements RetryStrategy contract", () => {
    const strategy = exponentialRetryStrategy;
    expect(typeof strategy.name).toBe("string");
    expect(typeof strategy.computeDelay).toBe("function");
  });
});
