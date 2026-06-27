import type { DeliveryJob } from "./types";
import type { CircuitBreakerRegistry } from "./circuit-breaker";
import type { RateLimiter } from "./rate-limiter";
import type { SecretProvider } from "./security/secret-provider";
import type { IntegrationRegistry } from "./registry";
import type { DeadLetterQueue } from "./dead-letter";
import type { IntegrationObserver } from "./observer";
import type { Scheduler } from "./scheduler";
import type { RetryStrategy } from "./retry-strategy";
import type { SchemaValidator } from "./schema-validator";
import { DeliveryExecutor } from "./executor";
import { TimerScheduler } from "./scheduler";

export interface DeliveryQueueOptions {
  registry:        IntegrationRegistry;
  circuitBreakers: CircuitBreakerRegistry;
  rateLimiter:     RateLimiter;
  secretProvider:  SecretProvider;
  dlq:             DeadLetterQueue;
  observer:        IntegrationObserver;
  maxConcurrent?:  number;
  scheduler?:      Scheduler;
  retryStrategy?:  RetryStrategy;
  validator?:      SchemaValidator;
}

export class DeliveryQueue {
  private readonly executor:      DeliveryExecutor;
  private readonly scheduler:     Scheduler;
  private readonly observer:      IntegrationObserver;
  private readonly pending:       DeliveryJob[] = [];
  private          processing:    number        = 0;
  private readonly maxConcurrent: number;

  constructor(opts: DeliveryQueueOptions) {
    this.observer      = opts.observer;
    this.maxConcurrent = opts.maxConcurrent ?? 10;
    this.scheduler     = opts.scheduler ?? new TimerScheduler();

    this.executor = new DeliveryExecutor({
      registry:        opts.registry,
      circuitBreakers: opts.circuitBreakers,
      rateLimiter:     opts.rateLimiter,
      secretProvider:  opts.secretProvider,
      dlq:             opts.dlq,
      observer:        opts.observer,
      retryStrategy:   opts.retryStrategy,
      validator:       opts.validator,
      requeue: (job: DeliveryJob, delayMs: number) => {
        this.scheduler.schedule(() => {
          this.pending.push(job);
          this.drain();
        }, delayMs);
      },
    });
  }

  enqueue(job: DeliveryJob): void {
    this.pending.push(job);
    this.observer.setQueueDepth(job.config.adapterName, this.pending.length + this.processing);
    this.drain();
  }

  private drain(): void {
    while (this.processing < this.maxConcurrent && this.pending.length > 0) {
      const job = this.pending.shift()!;
      this.processing++;
      this.executor.execute(job)
        .catch(() => {})
        .finally(() => {
          this.processing--;
          this.observer.setQueueDepth(job.config.adapterName, this.pending.length + this.processing);
          this.drain();
        });
    }
  }

  depth():       number { return this.pending.length; }
  activeCount(): number { return this.processing; }
}
