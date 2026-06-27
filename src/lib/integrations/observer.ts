import type { DeliveryResult, IntegrationMetrics } from "./types";

interface AdapterStats {
  deliveries:    number;
  successes:     number;
  failures:      number;
  retries:       number;
  deadLettered:  number;
  circuitBreaks: number;
  latencies:     number[];
  queueDepth:    number;
  rateLimited:   number;
}

const MAX_LATENCIES = 200;

function emptyStats(): AdapterStats {
  return {
    deliveries:    0,
    successes:     0,
    failures:      0,
    retries:       0,
    deadLettered:  0,
    circuitBreaks: 0,
    latencies:     [],
    queueDepth:    0,
    rateLimited:   0,
  };
}

export class IntegrationObserver {
  private readonly stats = new Map<string, AdapterStats>();

  private get(name: string): AdapterStats {
    if (!this.stats.has(name)) this.stats.set(name, emptyStats());
    return this.stats.get(name)!;
  }

  recordDelivery(adapterName: string, result: DeliveryResult): void {
    const s = this.get(adapterName);
    s.deliveries++;
    if (result.ok) s.successes++;
    else           s.failures++;
    s.latencies.push(result.durationMs);
    if (s.latencies.length > MAX_LATENCIES) s.latencies.shift();
  }

  recordRetry(adapterName: string):       void { this.get(adapterName).retries++; }
  recordDeadLetter(adapterName: string):  void { this.get(adapterName).deadLettered++; }
  recordCircuitBreak(adapterName: string):void { this.get(adapterName).circuitBreaks++; }
  recordRateLimit(adapterName: string):   void { this.get(adapterName).rateLimited++; }

  setQueueDepth(adapterName: string, depth: number): void {
    this.get(adapterName).queueDepth = depth;
  }

  snapshot(adapterName: string): IntegrationMetrics {
    const s      = this.get(adapterName);
    const sorted = [...s.latencies].sort((a, b) => a - b);
    const avg    = sorted.length > 0
      ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length)
      : 0;
    const p95idx = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
    const p95    = sorted.length > 0 ? sorted[p95idx] : 0;

    return {
      adapterName,
      deliveries:    s.deliveries,
      successes:     s.successes,
      failures:      s.failures,
      retries:       s.retries,
      deadLettered:  s.deadLettered,
      circuitBreaks: s.circuitBreaks,
      avgLatencyMs:  avg,
      p95LatencyMs:  p95 ?? 0,
      queueDepth:    s.queueDepth,
      rateLimited:   s.rateLimited,
    };
  }

  snapshots(): IntegrationMetrics[] {
    return Array.from(this.stats.keys()).map(n => this.snapshot(n));
  }

  exportMetrics(): Record<string, IntegrationMetrics> {
    const out: Record<string, IntegrationMetrics> = {};
    Array.from(this.stats.keys()).forEach(name => { out[name] = this.snapshot(name); });
    return out;
  }

  reset(adapterName?: string): void {
    if (adapterName) this.stats.delete(adapterName);
    else             this.stats.clear();
  }
}
