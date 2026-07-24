import type { BusEvent } from "../event-bus/types";
import type { IntegrationConfig, IntegrationEvent } from "./types";
import type { TransformPipeline } from "./pipeline/types";
import type { DeliveryQueue } from "./queue";

// ── Config loader ──────────────────────────────────────────────────────────────

export interface ConfigLoader {
  load(formSlug: string): Promise<IntegrationConfig[]>;
}

export class InMemoryConfigLoader implements ConfigLoader {
  private readonly configs = new Map<string, IntegrationConfig[]>();

  set(formSlug: string, configs: IntegrationConfig[]): this {
    this.configs.set(formSlug, configs);
    return this;
  }

  async load(formSlug: string): Promise<IntegrationConfig[]> {
    return this.configs.get(formSlug) ?? [];
  }
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

export interface DispatcherOptions {
  pipeline:     TransformPipeline;
  queue:        DeliveryQueue;
  configLoader: ConfigLoader;
}

function toIntegrationEvent(event: BusEvent): IntegrationEvent {
  const payload = (event.payload as Record<string, unknown> | null) ?? {};
  return {
    id:            event.id,
    correlationId: event.correlationId,
    type:          event.type,
    formSlug:      (payload.formSlug as string | undefined) ?? "",
    sessionToken:  (payload.sessionToken as string | undefined) ?? "",
    timestamp:     event.timestamp,
    payload,
    meta:          (event.meta as Record<string, unknown> | null) ?? {},
    version:       1,
  };
}

function shouldProcess(config: IntegrationConfig, event: IntegrationEvent): boolean {
  // Meta recebe uma única conversão explícita: Lead, quando a etapa de telefone
  // é confirmada. Os demais eventos continuam disponíveis para analytics e
  // outras integrações, sem virar Lead por causa do nome configurado no Pixel.
  if (config.adapterName === "meta-pixel") {
    return event.type === "form.phone.answered";
  }
  if (!config.eventFilter || config.eventFilter.length === 0) return true;
  return config.eventFilter.includes(event.type);
}

function computeDeliveryId(eventId: string, configId: string): string {
  return `${eventId}:${configId}`;
}

export class Dispatcher {
  private readonly opts: DispatcherOptions;

  constructor(opts: DispatcherOptions) {
    this.opts = opts;
  }

  async dispatch(event: BusEvent): Promise<void> {
    const integrationEvent = toIntegrationEvent(event);
    if (!integrationEvent.formSlug) return;

    const transformed = this.opts.pipeline.run(integrationEvent, {
      formSlug:      integrationEvent.formSlug,
      correlationId: event.correlationId,
    });

    const configs = await this.opts.configLoader.load(integrationEvent.formSlug);

    for (const config of configs) {
      if (!config.enabled) continue;
      if (!shouldProcess(config, integrationEvent)) continue;

      this.opts.queue.enqueue({
        deliveryId:    computeDeliveryId(event.id, config.id),
        correlationId: event.correlationId,
        event:         transformed,
        config,
        attempt:       1,
        scheduledAt:   Date.now(),
      });
    }
  }
}
