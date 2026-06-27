import { describe, it, expect, vi, afterEach } from "vitest";
import { CircuitBreaker, CircuitBreakerRegistry } from "../circuit-breaker";

afterEach(() => vi.restoreAllMocks());

describe("CircuitBreaker — initial state", () => {
  it("starts CLOSED", () => {
    const cb = new CircuitBreaker();
    expect(cb.getState()).toBe("CLOSED");
    expect(cb.canProceed()).toBe(true);
  });
});

describe("CircuitBreaker — state transitions", () => {
  it("opens after failureThreshold consecutive failures", () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, windowMs: 60_000, resetTimeMs: 30_000 });
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe("CLOSED");
    cb.recordFailure();
    expect(cb.getState()).toBe("OPEN");
    expect(cb.canProceed()).toBe(false);
  });

  it("resets failure count after window expires", () => {
    const now = Date.now();
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(now)
      .mockReturnValueOnce(now + 70_000)  // outside 60s window
      .mockReturnValue(now + 70_000);

    const cb = new CircuitBreaker({ failureThreshold: 2, windowMs: 60_000, resetTimeMs: 5_000 });
    cb.recordFailure();  // at `now`
    cb.recordFailure();  // at `now + 70s` — window reset, so count = 1
    expect(cb.getState()).toBe("CLOSED");
  });

  it("transitions OPEN → HALF_OPEN after resetTimeMs", () => {
    const now = Date.now();
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(now)             // failure 1
      .mockReturnValueOnce(now)             // failure 2
      .mockReturnValueOnce(now)             // failure 3 → OPEN, openedAt = now
      .mockReturnValue(now + 31_000);       // canProceed check — 31s elapsed

    const cb = new CircuitBreaker({ failureThreshold: 3, windowMs: 60_000, resetTimeMs: 30_000 });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe("OPEN");
    expect(cb.canProceed()).toBe(true);     // time elapsed → HALF_OPEN
    expect(cb.getState()).toBe("HALF_OPEN");
  });

  it("HALF_OPEN → CLOSED on success", () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, windowMs: 60_000, resetTimeMs: 1 });
    cb.recordFailure(); // opens
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 100);
    cb.canProceed();    // → HALF_OPEN
    cb.recordSuccess();
    expect(cb.getState()).toBe("CLOSED");
  });

  it("HALF_OPEN → OPEN on failure", () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, windowMs: 60_000, resetTimeMs: 1 });
    cb.recordFailure(); // OPEN
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 100);
    cb.canProceed();    // HALF_OPEN
    cb.recordFailure(); // OPEN again
    expect(cb.getState()).toBe("OPEN");
    expect(cb.canProceed()).toBe(false);
  });

  it("success resets failure count to 0", () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, windowMs: 60_000, resetTimeMs: 30_000 });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess(); // resets
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe("CLOSED");  // only 2 after reset
  });
});

describe("CircuitBreaker — hooks", () => {
  it("calls onOpen when transitioning CLOSED → OPEN", () => {
    const onOpen = vi.fn();
    const cb = new CircuitBreaker({ failureThreshold: 1, windowMs: 60_000, resetTimeMs: 30_000, onOpen });
    cb.recordFailure();
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("calls onHalfOpen when transitioning OPEN → HALF_OPEN via canProceed()", () => {
    const onHalfOpen = vi.fn();
    const cb = new CircuitBreaker({ failureThreshold: 1, windowMs: 60_000, resetTimeMs: 1, onHalfOpen });
    cb.recordFailure();  // OPEN
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 100);
    cb.canProceed();     // → HALF_OPEN
    expect(onHalfOpen).toHaveBeenCalledOnce();
  });

  it("calls onClose when transitioning OPEN/HALF_OPEN → CLOSED via success", () => {
    const onClose = vi.fn();
    const cb = new CircuitBreaker({ failureThreshold: 1, windowMs: 60_000, resetTimeMs: 1, onClose });
    cb.recordFailure();  // OPEN
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 100);
    cb.canProceed();     // HALF_OPEN
    cb.recordSuccess();  // → CLOSED
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does NOT call onClose when already CLOSED", () => {
    const onClose = vi.fn();
    const cb = new CircuitBreaker({ failureThreshold: 3, windowMs: 60_000, resetTimeMs: 30_000, onClose });
    cb.recordSuccess();  // was already CLOSED
    expect(onClose).not.toHaveBeenCalled();
  });

  it("works normally without hooks (no crash)", () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, windowMs: 60_000, resetTimeMs: 30_000 });
    cb.recordFailure();
    expect(cb.getState()).toBe("OPEN");
  });
});

describe("CircuitBreakerRegistry", () => {
  it("creates a new breaker for unknown keys", () => {
    const reg = new CircuitBreakerRegistry();
    const cb1 = reg.get("meta-pixel");
    const cb2 = reg.get("meta-pixel");
    expect(cb1).toBe(cb2);  // same instance
  });

  it("isolates breakers by key", () => {
    const reg = new CircuitBreakerRegistry({ failureThreshold: 1, windowMs: 60_000, resetTimeMs: 30_000 });
    reg.get("meta-pixel").recordFailure();
    expect(reg.get("meta-pixel").getState()).toBe("OPEN");
    expect(reg.get("ga4").getState()).toBe("CLOSED");
  });

  it("all() returns all registered breakers", () => {
    const reg = new CircuitBreakerRegistry();
    reg.get("a");
    reg.get("b");
    expect(reg.all().size).toBe(2);
  });
});
