import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventConsumer }  from "@/lib/event-bus/types";
import { ConsumerPriority }    from "@/lib/event-bus/types";
import { dispatchConversions } from "./dispatcher";
import type { ConversionEventResolver } from "./event-resolvers/types";
import type { ProviderContext } from "./registry";

// Side-effect: registers all platform providers into the registry.
import "./providers/meta";
import "./providers/google";

// ─────────────────────────────────────────────────────────────────────────────
// Platform Conversion Engine — EventConsumer factory
//
// Accepts an array of ConversionEventResolvers. Each resolver declares which
// domain events it handles; the engine subscribes only to those events.
//
// Adding a new domain (bookings, checkout, subscriptions…) requires only:
//   1. Implement ConversionEventResolver.
//   2. Pass it to createConversionEngine() in platform.ts.
//   Zero changes to engine, dispatcher, or providers.
// ─────────────────────────────────────────────────────────────────────────────

export interface ConversionEngineOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db:        SupabaseClient<any, any, any>;
  resolvers: ConversionEventResolver[];
}

export function createConversionEngine(opts: ConversionEngineOptions): EventConsumer {
  const { db, resolvers } = opts;

  // Collect subscribed events from all resolvers — each event appears once.
  const seen = new Set<string>();
  const subscribedEvents: string[] = [];
  for (const resolver of resolvers) {
    for (const event of resolver.events) {
      if (!seen.has(event)) {
        seen.add(event);
        subscribedEvents.push(event);
      }
    }
  }

  return {
    name:     "conversion-engine",
    priority: ConsumerPriority.NORMAL,
    events:   subscribedEvents,

    async handle(event): Promise<void> {
      // Find the resolver responsible for this event type.
      const resolver = resolvers.find(r => (r.events as string[]).includes(event.type));
      if (!resolver) return;

      const resolved = await resolver.resolve(db, event);
      if (!resolved || resolved.rules.length === 0) return;

      const context: ProviderContext = { db, now: new Date() };
      await dispatchConversions(resolved.rules, resolved.conversionEvent, context);
    },
  };
}
