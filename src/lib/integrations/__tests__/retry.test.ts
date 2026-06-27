import { describe, it, expect } from "vitest";
import { DEFAULT_RETRY_POLICY, computeDelay, isRetryable, mergeRetryPolicy } from "../retry";

describe("DEFAULT_RETRY_POLICY", () => {
  it("has sensible defaults", () => {
    expect(DEFAULT_RETRY_POLICY.maxAttempts).toBe(3);
    expect(DEFAULT_RETRY_POLICY.backoffFactor).toBe(2);
    expect(DEFAULT_RETRY_POLICY.jitter).toBe(true);
    expect(DEFAULT_RETRY_POLICY.retryableStatuses).toContain(429);
    expect(DEFAULT_RETRY_POLICY.retryableStatuses).toContain(500);
  });
});

describe("mergeRetryPolicy()", () => {
  it("returns base when no override", () => {
    expect(mergeRetryPolicy(DEFAULT_RETRY_POLICY, undefined)).toEqual(DEFAULT_RETRY_POLICY);
  });

  it("merges partial overrides", () => {
    const merged = mergeRetryPolicy(DEFAULT_RETRY_POLICY, { maxAttempts: 5 });
    expect(merged.maxAttempts).toBe(5);
    expect(merged.backoffFactor).toBe(DEFAULT_RETRY_POLICY.backoffFactor);
  });

  it("overrides all fields when full policy given", () => {
    const full = { ...DEFAULT_RETRY_POLICY, maxAttempts: 10, timeoutMs: 999 };
    expect(mergeRetryPolicy(DEFAULT_RETRY_POLICY, full)).toEqual(full);
  });
});

describe("computeDelay()", () => {
  const policy = { ...DEFAULT_RETRY_POLICY, jitter: false };

  it("returns initialDelayMs for attempt=1", () => {
    expect(computeDelay(policy, 1)).toBe(1_000);
  });

  it("doubles delay for each attempt (backoffFactor=2)", () => {
    expect(computeDelay(policy, 2)).toBe(2_000);
    expect(computeDelay(policy, 3)).toBe(4_000);
  });

  it("caps at maxDelayMs", () => {
    const capped = { ...policy, maxDelayMs: 3_000 };
    expect(computeDelay(capped, 10)).toBe(3_000);
  });

  it("returns value in [0, base] when jitter=true", () => {
    const jittered = { ...DEFAULT_RETRY_POLICY, jitter: true, initialDelayMs: 1000 };
    for (let i = 0; i < 20; i++) {
      const d = computeDelay(jittered, 1);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(1000);
    }
  });
});

describe("isRetryable()", () => {
  it("returns true for undefined status (network error)", () => {
    expect(isRetryable(undefined, DEFAULT_RETRY_POLICY)).toBe(true);
  });

  it("returns true for retryable statuses", () => {
    expect(isRetryable(500, DEFAULT_RETRY_POLICY)).toBe(true);
    expect(isRetryable(429, DEFAULT_RETRY_POLICY)).toBe(true);
    expect(isRetryable(503, DEFAULT_RETRY_POLICY)).toBe(true);
  });

  it("returns false for non-retryable statuses", () => {
    expect(isRetryable(400, DEFAULT_RETRY_POLICY)).toBe(false);
    expect(isRetryable(401, DEFAULT_RETRY_POLICY)).toBe(false);
    expect(isRetryable(403, DEFAULT_RETRY_POLICY)).toBe(false);
    expect(isRetryable(404, DEFAULT_RETRY_POLICY)).toBe(false);
    expect(isRetryable(200, DEFAULT_RETRY_POLICY)).toBe(false);
  });
});
