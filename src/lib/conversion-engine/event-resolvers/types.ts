import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusEvent }       from "@/lib/event-bus/types";
import type { ConversionEvent } from "../conversion-event";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

// ─────────────────────────────────────────────────────────────────────────────
// Platform Conversion Engine — Resolver contracts
//
// A ConversionEventResolver is the single extension point for new domains.
// To add bookings, checkouts, subscriptions or any future domain:
//   1. Implement ConversionEventResolver.
//   2. Register it in platform.ts alongside the CRM resolver.
//   Zero changes to engine.ts, dispatcher.ts, or any provider.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Domain-agnostic representation of a conversion rule.
 *
 * Replaces CrmStageConversion / AppointmentConversion at the provider boundary.
 * Providers receive only `platform` and `settings` — they never know whether
 * the rule originated from a CRM stage or a booking calendar.
 */
export interface ConversionRule {
  id:       string;
  platform: string;
  settings: Record<string, unknown>;
  enabled:  boolean;
}

/**
 * Everything a dispatcher needs to fire providers — fully resolved,
 * no further DB queries required.
 */
export interface ResolvedConversion {
  conversionEvent: ConversionEvent;
  rules:           ConversionRule[];
}

/**
 * A resolver bridges one or more domain events to the provider pipeline.
 *
 * Contract:
 *   • Declare which events you handle via `events`.
 *   • `resolve()` loads conversion rules AND builds the ConversionEvent.
 *   • Return null to silently skip (no rules, lead not found, etc.).
 *   • Never throw — callers treat null as "nothing to dispatch".
 */
export interface ConversionEventResolver {
  readonly events: ReadonlyArray<string>;
  resolve(db: Db, event: BusEvent): Promise<ResolvedConversion | null>;
}
