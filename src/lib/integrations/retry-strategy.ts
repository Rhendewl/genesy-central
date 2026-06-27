import type { RetryPolicy } from "./types";
import { computeDelay } from "./retry";

export interface RetryStrategy {
  readonly name: string;
  computeDelay(policy: RetryPolicy, attempt: number): number;
}

export const exponentialRetryStrategy: RetryStrategy = {
  name: "exponential",
  computeDelay,
};
