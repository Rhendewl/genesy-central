import type { RetryPolicy } from "./types";

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts:       3,
  initialDelayMs:    1_000,
  maxDelayMs:        30_000,
  backoffFactor:     2,
  jitter:            true,
  timeoutMs:         10_000,
  retryableStatuses: [429, 500, 502, 503, 504],
};

export function mergeRetryPolicy(
  base:     RetryPolicy,
  override: Partial<RetryPolicy> | undefined,
): RetryPolicy {
  if (!override) return base;
  return { ...base, ...override };
}

/**
 * Exponential backoff with optional full jitter.
 * attempt is 1-based (attempt=1 → first retry delay).
 */
export function computeDelay(policy: RetryPolicy, attempt: number): number {
  const base = Math.min(
    policy.initialDelayMs * Math.pow(policy.backoffFactor, attempt - 1),
    policy.maxDelayMs,
  );
  if (!policy.jitter) return Math.floor(base);
  return Math.floor(Math.random() * base);
}

export function isRetryable(status: number | undefined, policy: RetryPolicy): boolean {
  if (status === undefined) return true;   // network error — always retry
  return policy.retryableStatuses.includes(status);
}
