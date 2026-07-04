import { createEventBus } from "./bus";
import { InMemoryAdapter } from "./storage";
import type { EventBus } from "./types";
import type { DomainEventType } from "./domain-events";
import { createConversionEngine }            from "@/lib/conversion-engine/engine";
import { crmResolver }                       from "@/lib/conversion-engine/event-resolvers/crm";
import { bookingResolver }                   from "@/lib/conversion-engine/event-resolvers/booking";
import { createPushNotificationConsumer }      from "@/lib/event-bus/appointments/consumers/push-notification";
import { createCrmStageNotificationConsumer } from "@/lib/event-bus/crm/consumers/stage-notification";
import { createAdminSupabaseClient }          from "@/lib/supabase-admin";

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

  const db = createAdminSupabaseClient();

  // Conversion Engine is the first consumer; future modules (Automations,
  // Analytics) will subscribe here too without touching CRM or LeadService.
  // To add a new domain: pass its resolver alongside crmResolver — zero other changes.
  _bus.subscribe(createConversionEngine({
    db,
    resolvers: [crmResolver, bookingResolver],
  }));

  // Agenda: push notification on booking.created
  _bus.subscribe(createPushNotificationConsumer(db));

  // CRM: push notification on lead.stage.entered
  _bus.subscribe(createCrmStageNotificationConsumer(db));

  return _bus;
}
