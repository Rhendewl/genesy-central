import { describe, it, expect, vi, afterEach } from "vitest";
import { RateLimiter } from "../rate-limiter";

afterEach(() => vi.restoreAllMocks());

describe("RateLimiter", () => {
  it("allows requests within limit", () => {
    const rl = new RateLimiter();
    expect(rl.acquire("key", 60)).toBe(true);   // 60 req/min → bucket full on first access
    expect(rl.acquire("key", 60)).toBe(true);
  });

  it("blocks when bucket is empty", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);

    const rl = new RateLimiter();
    // 1 req/min means capacity=1, one request drains it
    expect(rl.acquire("key", 1)).toBe(true);
    expect(rl.acquire("key", 1)).toBe(false);   // bucket empty
  });

  it("refills tokens over time", () => {
    const now = Date.now();
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(now)             // first acquire
      .mockReturnValueOnce(now + 60_000)    // refill check (after 1 full minute)
      .mockReturnValue(now + 60_000);

    const rl = new RateLimiter();
    rl.acquire("key", 1);    // drains
    expect(rl.acquire("key", 1)).toBe(true); // refilled after 60s
  });

  it("isolates keys independently", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);

    const rl = new RateLimiter();
    rl.acquire("a", 1); // drains "a"
    expect(rl.acquire("b", 1)).toBe(true);  // "b" is untouched
    expect(rl.acquire("a", 1)).toBe(false); // "a" empty
  });

  it("reset() removes a bucket (fresh state on next acquire)", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);

    const rl = new RateLimiter();
    rl.acquire("key", 1);    // drains
    rl.reset("key");
    expect(rl.acquire("key", 1)).toBe(true); // fresh bucket
  });

  it("resetAll() clears all buckets", () => {
    const rl = new RateLimiter();
    rl.acquire("a", 1);
    rl.acquire("b", 1);
    expect(rl.bucketCount()).toBe(2);
    rl.resetAll();
    expect(rl.bucketCount()).toBe(0);
  });
});
