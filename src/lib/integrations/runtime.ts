import { IntegrationObserver } from "./observer";
import { DeadLetterQueue }      from "./dead-letter";
import { IntegrationRegistry }  from "./registry";
import { CircuitBreakerRegistry } from "./circuit-breaker";
import { RateLimiter }          from "./rate-limiter";
import { PlainSecretProvider }  from "./security/secret-provider";
import { DeliveryQueue }        from "./queue";
import { PipelineBuilder }      from "./pipeline/builder";
import { normalizeTransform }   from "./pipeline/transforms/normalize";
import { enrichTransform }      from "./pipeline/transforms/enrich";
import { maskTransform }        from "./pipeline/transforms/mask";
import { metaMapper }           from "./mappers/meta";
import { googleAnalyticsMapper }from "./mappers/google-analytics";
import { webhookMapper }        from "./mappers/webhook";
import { crmMapper }            from "./mappers/crm";
import { MetaPixelAdapter }     from "./adapters/meta-pixel";
import { GoogleAnalyticsAdapter }from "./adapters/google-analytics";
import { WebhookAdapter }       from "./adapters/webhook";
import { CRMAdapter }           from "./adapters/crm";
import type { DeliveryResult }  from "./types";

// ── History entry ─────────────────────────────────────────────────────────────

export interface DeliveryHistoryEntry {
  id:            string;
  adapterName:   string;
  correlationId: string;
  eventType:     string;
  ok:            boolean;
  statusCode?:   number;
  durationMs:    number;
  timestamp:     number;
  attempt:       number;
  error?:        string;
}

// ── History-aware observer ────────────────────────────────────────────────────

export class HistoryAwareObserver extends IntegrationObserver {
  private readonly hist: DeliveryHistoryEntry[] = [];
  private readonly MAX = 200;

  // Called with eventType from the queue wrapper
  pushHistory(adapterName: string, eventType: string, result: DeliveryResult): void {
    super.recordDelivery(adapterName, result);
    this.hist.unshift({
      id:            `${adapterName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      adapterName,
      correlationId: result.correlationId,
      eventType,
      ok:            result.ok,
      statusCode:    result.status,
      durationMs:    result.durationMs,
      timestamp:     Date.now(),
      attempt:       result.attempt,
      error:         result.error,
    });
    if (this.hist.length > this.MAX) this.hist.pop();
  }

  getHistory(adapterName?: string): DeliveryHistoryEntry[] {
    return adapterName ? this.hist.filter(e => e.adapterName === adapterName) : [...this.hist];
  }

  clearHistory(): void { this.hist.length = 0; }
}

// ── Lazy singleton factory ────────────────────────────────────────────────────

interface IntegrationRuntime {
  observer:        HistoryAwareObserver;
  dlq:             DeadLetterQueue;
  registry:        IntegrationRegistry;
  circuitBreakers: CircuitBreakerRegistry;
  rateLimiter:     RateLimiter;
  secretProvider:  PlainSecretProvider;
  queue:           DeliveryQueue;
  pipeline:        ReturnType<PipelineBuilder["build"]>;
}

let _runtime: IntegrationRuntime | null = null;

export function getIntegrationRuntime(): IntegrationRuntime {
  if (_runtime) return _runtime;

  const observer        = new HistoryAwareObserver();
  const dlq             = new DeadLetterQueue();
  const registry        = new IntegrationRegistry();
  const circuitBreakers = new CircuitBreakerRegistry();
  const rateLimiter     = new RateLimiter();
  const secretProvider  = new PlainSecretProvider();

  registry.register(new MetaPixelAdapter(),       metaMapper);
  registry.register(new GoogleAnalyticsAdapter(), googleAnalyticsMapper);
  registry.register(new WebhookAdapter(),         webhookMapper);
  registry.register(new CRMAdapter(),             crmMapper);

  const pipeline = new PipelineBuilder()
    .use(normalizeTransform)
    .use(enrichTransform)
    .use(maskTransform)
    .build();

  const queue = new DeliveryQueue({
    registry, circuitBreakers, rateLimiter, secretProvider, dlq, observer,
  });

  _runtime = { observer, dlq, registry, circuitBreakers, rateLimiter, secretProvider, queue, pipeline };
  return _runtime;
}
