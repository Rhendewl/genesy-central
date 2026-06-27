// Token bucket — refills continuously at requestsPerMinute / 60000 tokens/ms.

interface Bucket {
  tokens:     number;
  lastRefill: number;
  capacity:   number;
  ratePerMs:  number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  /**
   * Returns true if the request is allowed, false if rate-limited.
   * @param key               e.g. "meta-pixel:form-slug"
   * @param requestsPerMinute capacity / refill rate
   */
  acquire(key: string, requestsPerMinute: number): boolean {
    const capacity  = requestsPerMinute;
    const ratePerMs = requestsPerMinute / 60_000;
    const now       = Date.now();

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: capacity, lastRefill: now, capacity, ratePerMs };
      this.buckets.set(key, bucket);
    }

    const elapsed = now - bucket.lastRefill;
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + elapsed * bucket.ratePerMs);
    bucket.lastRefill = now;

    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }

  reset(key: string): void   { this.buckets.delete(key); }
  resetAll():         void   { this.buckets.clear(); }
  bucketCount():      number { return this.buckets.size; }
}
