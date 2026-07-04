import { createEventBus } from "./bus";
import { InMemoryAdapter } from "./storage";
import type { EventBus } from "./types";
import type { DomainEventType } from "./domain-events";
import { createConversionEngine } from "@/lib/conversion-engine/engine";
import { crmResolver }            from "@/lib/conversion-engine/event-resolvers/crm";
import { bookingResolver }        from "@/lib/conversion-engine/event-resolvers/booking";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

// ─────────────────────────────────────────────────────────────────────────────
// Platform-wide EventBus singleton for server-side domain events.
//
// Created once per server process. Any module (CRM, Forms, …) that needs to
// publish lead.* events imports getPlatformEventBus() — never creates its own
// bus instance. The Conversion Engine consumer is subscribed lazily on first
// access so all producers share the same consumer registry automatically.
// ─────────────────────────────────────────────────────────────────────────────

let _bus: EventBus<DomainEventType> | null = null;

export function getPlatformEventBus(): EventBus<DomainEventType> {
  if (_bus) return _bus;

  _bus = createEventBus<DomainEventType>({
    source:  "platform",
    storage: new InMemoryAdapter(),
  });

  // Conversion Engine is the first consumer; future modules (Automations,
  // Analytics) will subscribe here too without touching CRM or LeadService.
  // To add a new domain: pass its resolver alongside crmResolver — zero other changes.
  _bus.subscribe(createConversionEngine({
    db:        createAdminSupabaseClient(),
    resolvers: [crmResolver, bookingResolver],
  }));

  return _bus;
}
