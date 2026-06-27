import type { BusEvent, EventConsumer } from "../event-bus/types";
import { ConsumerPriority } from "../event-bus/types";
import type { TransformPipeline } from "./pipeline/types";
import type { DeliveryQueue } from "./queue";
import { Dispatcher } from "./dispatcher";

// Re-export for backward compatibility
export type { ConfigLoader } from "./dispatcher";
export { InMemoryConfigLoader } from "./dispatcher";

// ── Manager options ───────────────────────────────────────────────────────────

export interface IntegrationManagerOptions {
  pipeline:     TransformPipeline;
  queue:        DeliveryQueue;
  configLoader: import("./dispatcher").ConfigLoader;
}

export function createIntegrationManager(opts: IntegrationManagerOptions): EventConsumer {
  const dispatcher = new Dispatcher(opts);

  return {
    name:     "integrations",
    priority: ConsumerPriority.NORMAL,
    events:   "*",

    async handle(event: BusEvent): Promise<void> {
      await dispatcher.dispatch(event);
    },
  };
}
