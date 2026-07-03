// ── BookingMetaPixelSyncService ────────────────────────────────────────────────
// Fires a Meta Conversions API event when a booking is created.
//
// DESIGN CONTRACT:
//   • Never throws — failure is recorded in history but never blocks booking.
//   • Server-side only — never uses browser pixel.
//   • Reuses hash utilities from conversion-engine directly.
//   • All PII hashed SHA-256 before sending.

import { decryptToken }   from "@/lib/crypto";
import {
  hashEmail,
  hashPhone,
  hashFirstName,
  hashLastName,
} from "@/lib/conversion-engine/utils/hash";
import type { AppointmentMetaPixelSettings } from "@/types/appointments";
import type { SupabaseClient }               from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

const GRAPH_API_VERSION = "v23.0";

export interface MetaPixelSyncPayload {
  bookingId:     string;
  calendarId:    string;
  calendarName:  string;
  userId:        string;
  metaSettings:  AppointmentMetaPixelSettings | null | undefined;
  visitorName:   string;
  visitorEmail:  string;
  visitorPhone:  string | null;
  startsAt:      string;
  pageUrl:       string | null;
  attribution:   Record<string, unknown>;
  correlationId: string | null;
}

export class BookingMetaPixelSyncService {
  constructor(private readonly db: Db) {}

  async syncBooking(payload: MetaPixelSyncPayload): Promise<void> {
    try {
      await this._doSync(payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[MetaPixelSync] Failed for booking ${payload.bookingId}:`, msg);
      void this.db.from("appointment_booking_history").insert({
        booking_id: payload.bookingId,
        user_id:    payload.userId,
        event_type: "meta_failed",
        actor:      "system",
        actor_id:   null,
        payload:    { error: msg },
      }).then();
    }
  }

  private async _doSync(payload: MetaPixelSyncPayload): Promise<void> {
    const cfg = payload.metaSettings;
    if (!cfg?.enabled || !cfg.pixel_id || !cfg.access_token) return;

    const accessToken = decryptToken(cfg.access_token);
    const attr        = payload.attribution as Record<string, string | undefined>;

    // Build user_data with SHA-256 hashed PII
    const user_data: Record<string, unknown> = {};
    if (payload.visitorEmail) user_data.em = hashEmail(payload.visitorEmail);
    if (payload.visitorPhone) {
      const ph = hashPhone(payload.visitorPhone);
      if (ph) user_data.ph = ph;
    }
    if (payload.visitorName) {
      user_data.fn = hashFirstName(payload.visitorName);
      const ln = hashLastName(payload.visitorName);
      if (ln) user_data.ln = ln;
    }

    // Raw signals (not hashed — Meta requirement)
    if (attr.ip)         user_data.client_ip_address = attr.ip;
    if (attr.user_agent) user_data.client_user_agent = attr.user_agent;
    if (attr.fbp)        user_data.fbp               = attr.fbp;
    if (attr.fbc)        user_data.fbc               = attr.fbc;

    // custom_data
    const custom_data: Record<string, unknown> = {
      calendar_id:   payload.calendarId,
      calendar_name: payload.calendarName,
      booking_id:    payload.bookingId,
      starts_at:     payload.startsAt,
    };
    if (attr.utm_source)   custom_data.utm_source   = attr.utm_source;
    if (attr.utm_medium)   custom_data.utm_medium   = attr.utm_medium;
    if (attr.utm_campaign) custom_data.utm_campaign = attr.utm_campaign;
    if (payload.correlationId) custom_data.correlation_id = payload.correlationId;

    // Resolve event name: custom mode uses fbq('trackCustom', name)
    const eventName = cfg.event_name || "Chronos_Scheduled";

    const apiEvent: Record<string, unknown> = {
      event_name:        eventName,
      event_time:        Math.floor(Date.now() / 1000),
      action_source:     "website",
      user_data,
      custom_data,
    };
    if (payload.pageUrl) apiEvent.event_source_url = payload.pageUrl;

    const body: Record<string, unknown> = { data: [apiEvent] };
    if (cfg.test_event_code) body.test_event_code = cfg.test_event_code;

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${cfg.pixel_id}/events`;
    const res = await fetch(url, {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const responseBody = await res.json() as Record<string, unknown>;

    const eventType = cfg.test_event_code ? "meta_test_sent" : "meta_sent";

    void this.db.from("appointment_booking_history").insert({
      booking_id: payload.bookingId,
      user_id:    payload.userId,
      event_type: eventType,
      actor:      "system",
      actor_id:   null,
      payload:    {
        http_status:   res.status,
        event_name:    eventName,
        pixel_id:      cfg.pixel_id,
        response:      responseBody,
        sent_payload:  { event_name: eventName, custom_data },
      },
    }).then();

    if (!res.ok) {
      throw new Error(`Meta CAPI responded ${res.status}: ${JSON.stringify(responseBody)}`);
    }
  }
}
