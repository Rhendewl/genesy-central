import type { CircuitState } from "./types";

export interface CircuitBreakerConfig {
  failureThreshold: number;
  windowMs:         number;
  resetTimeMs:      number;
  onOpen?:          () => void;
  onHalfOpen?:      () => void;
  onClose?:         () => void;
}

const DEFAULTS: CircuitBreakerConfig = {
  failureThreshold: 5,
  windowMs:         60_000,
  resetTimeMs:      30_000,
};

export class CircuitBreaker {
  private state:         CircuitState = "CLOSED";
  private failures:      number       = 0;
  private lastFailureAt: number       = 0;
  private openedAt:      number       = 0;
  private readonly cfg:  CircuitBreakerConfig;

  constructor(cfg: Partial<CircuitBreakerConfig> = {}) {
    this.cfg = { ...DEFAULTS, ...cfg };
  }

  getState(): CircuitState { return this.state; }

  canProceed(): boolean {
    if (this.state === "CLOSED")    return true;
    if (this.state === "HALF_OPEN") return true;

    // OPEN — check if resetTimeMs has elapsed
    if (Date.now() - this.openedAt >= this.cfg.resetTimeMs) {
      this.state = "HALF_OPEN";
      this.cfg.onHalfOpen?.();
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    const wasOpen = this.state !== "CLOSED";
    this.failures = 0;
    this.state    = "CLOSED";
    if (wasOpen) this.cfg.onClose?.();
  }

  recordFailure(): void {
    const now = Date.now();

    // Reset counter if outside the rolling window
    if (now - this.lastFailureAt > this.cfg.windowMs) {
      this.failures = 0;
    }

    this.failures++;
    this.lastFailureAt = now;

    if (this.state === "HALF_OPEN" || this.failures >= this.cfg.failureThreshold) {
      this.state    = "OPEN";
      this.openedAt = now;
      this.failures = 0;
      this.cfg.onOpen?.();
    }
  }
}

export class CircuitBreakerRegistry {
  private readonly breakers = new Map<string, CircuitBreaker>();
  private readonly cfg:      Partial<CircuitBreakerConfig>;

  constructor(cfg: Partial<CircuitBreakerConfig> = {}) { this.cfg = cfg; }

  get(key: string): CircuitBreaker {
    if (!this.breakers.has(key)) {
      this.breakers.set(key, new CircuitBreaker(this.cfg));
    }
    return this.breakers.get(key)!;
  }

  all(): Map<string, CircuitBreaker> { return this.breakers; }
}
