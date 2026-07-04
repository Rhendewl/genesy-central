import type { SupabaseClient }          from "@supabase/supabase-js";
import type { BusEvent }               from "@/lib/event-bus/types";
import type { BookingEventPayload }    from "@/lib/event-bus/domain-events";
import { buildIdentitySignals }        from "../identity-signals";
import { buildAttribution }            from "../event-context";
import { buildConversionEvent }        from "../conversion-event";
import type { ConversionEventResolver, ConversionRule, ResolvedConversion } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

// ─────────────────────────────────────────────────────────────────────────────
// Booking Resolver
//
// Second implementation of ConversionEventResolver — the first outside the CRM
// domain. Validates that the Platform Conversion Engine supports multiple domains
// without any modification to engine, dispatcher, registry, or providers.
//
// Handles: "booking.created"
// Source:  BookingService (publishes after successful DB insert)
//
// Responsibilities:
//   1. Load enabled appointment_conversions for the calendar + trigger_event.
//   2. Build IdentitySignals from visitor data carried in the event payload.
//   3. Build a domain-agnostic ConversionEvent via the shared builder (no CRM).
//   4. Return ResolvedConversion to the dispatcher.
//
// This resolver never sends events to Meta, calls providers, or reads
// crm_stage_conversions, leads, or form_submissions.
// ─────────────────────────────────────────────────────────────────────────────

export const bookingResolver: ConversionEventResolver = {
  events: ["booking.created", "booking.confirmed"],

  async resolve(db: Db, event: BusEvent): Promise<ResolvedConversion | null> {
    const payload = event.payload as BookingEventPayload;
    if (!payload?.bookingId || !payload?.calendarId) return null;

    // 1. Load enabled conversion rules for this calendar + trigger.
    //    event.type drives which trigger_event rows are loaded —
    //    no code change needed when adding future booking.* events.
    const { data: rows } = await db
      .from("appointment_conversions")
      .select("id, platform, platform_integration_id, settings, enabled")
      .eq("calendar_id", payload.calendarId)
      .eq("trigger_event", event.type)
      .eq("enabled", true);

    if (!rows?.length) return null;

    // 2. Build identity signals from visitor data in the payload.
    //    Phone maps to `contact`; bookingId is the stable external_id.
    const attr = payload.attribution as Record<string, string | undefined>;

    const identity = buildIdentitySignals(
      {
        id:      payload.bookingId,
        name:    payload.visitorName,
        contact: payload.visitorPhone ?? "",
        email:   payload.visitorEmail,
      },
      {
        ip:         attr.ip         ?? null,
        fbp:        attr.fbp        ?? null,
        fbc:        attr.fbc        ?? null,
        user_agent: attr.user_agent ?? null,
        country:    null,
        city:       null,
      },
    );

    // 3. Build attribution via the centralised helper — no inline mapping.
    const attribution = buildAttribution(payload.attribution);

    // 4. Build ConversionEvent via the shared platform builder.
    //    No CRM context for booking events; dealValue is null (no monetary value).
    const conversionEvent = buildConversionEvent({
      event,
      identity,
      attribution,
      commerce:     { dealValue: null },
      actionSource: "website",
      // crm is intentionally absent — providers handle this gracefully.
    });

    const rules: ConversionRule[] = rows.map(r => ({
      id:                      r.id                      as string,
      platform:                r.platform                as string,
      platform_integration_id: r.platform_integration_id as string | null,
      settings:                r.settings                as Record<string, unknown>,
      enabled:                 r.enabled                 as boolean,
    }));

    return { conversionEvent, rules };
  },
};
