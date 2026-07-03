// ── GoogleCalendarSyncService ─────────────────────────────────────────────────
// Orchestrates the full sync of a booking to Google Calendar.
//
// DESIGN CONTRACT:
//   • Never throws — all errors are caught, logged, and recorded in history.
//   • Booking creation/confirmation always proceeds regardless of Google errors.
//   • Called fire-and-forget from the PATCH /api/appointments/bookings/[id] route
//     when status transitions to "confirmed".
//
// ARCHITECTURE:
//   BookingService / PATCH route
//     └─ (confirmed) → GoogleCalendarSyncService.syncBooking()   ← here
//          ├─ GoogleConnectionRepository   (DB read)
//          ├─ GoogleTokenService           (auto-refresh)
//          └─ GoogleCalendarService        (API write)

import type { SupabaseClient }          from "@supabase/supabase-js";
import { GoogleConnectionRepository }   from "./google-connection-repository";
import { GoogleTokenService }           from "./google-token-service";
import { createCalendarEvent }          from "./google-calendar-service";
import type { SyncBookingPayload }      from "@/types/google-calendar";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export class GoogleCalendarSyncService {
  private readonly repo:  GoogleConnectionRepository;
  private readonly tokens: GoogleTokenService;

  constructor(private readonly db: Db) {
    this.repo   = new GoogleConnectionRepository(db);
    this.tokens = new GoogleTokenService(db);
  }

  // Entry point — non-throwing, fire-and-forget safe.
  async syncBooking(payload: SyncBookingPayload): Promise<void> {
    console.log(`[GCal] SYNC START bookingId=${payload.bookingId} userId=${payload.userId} calendarId=${payload.calendarId}`);
    try {
      await this._doSync(payload);
      console.log(`[GCal] SYNC COMPLETE bookingId=${payload.bookingId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[GCal] SYNC FAILED bookingId=${payload.bookingId}:`, msg);

      // Record failure in history (non-fatal)
      void this.db.from("appointment_booking_history").insert({
        booking_id: payload.bookingId,
        user_id:    payload.userId,
        event_type: "google_sync_failed",
        actor:      "system",
        actor_id:   null,
        payload:    { error: msg, calendar_id: payload.calendarId },
      }).then();

      // Update connection status
      void this.repo.updateSyncStatus(payload.userId, "error", null, msg).catch(() => undefined);
    }
  }

  private async _doSync(payload: SyncBookingPayload): Promise<void> {
    // 1. Check connection exists and auto_create_events is enabled
    const connection = await this.repo.findByUserId(payload.userId);
    console.log(`[GCal] STEP 1 connection=${connection ? `found (is_active=${connection.is_active} auto_create=${connection.auto_create_events})` : "NOT FOUND"}`);
    if (!connection || !connection.is_active || !connection.auto_create_events) {
      console.log(`[GCal] STEP 1 ABORT — no connection or auto_create disabled`);
      return;
    }

    // 2. Mark syncing
    await this.repo.updateSyncStatus(payload.userId, "syncing", null, null);
    console.log(`[GCal] STEP 2 marked syncing`);

    // 3. Get valid (auto-refreshed) access token
    const accessToken = await this.tokens.getValidAccessToken(payload.userId);
    console.log(`[GCal] STEP 3 token retrieved (${accessToken.length} chars)`);

    // 4. Build event description
    const description = this._buildDescription(payload);

    // 5. Build event title: "Calendar Name • Visitor Name"
    const summary = `${payload.calendarName} • ${payload.visitorName}`;

    // 6. Create event in user's primary Google Calendar
    console.log(`[GCal] STEP 6 calling Google API — summary="${summary}" start=${payload.startsAt} end=${payload.endsAt} tz=${payload.timezone} attendee=${payload.visitorEmail}`);
    const event = await createCalendarEvent({
      accessToken,
      googleCalendarId: "primary",
      summary,
      description,
      startDateTime: payload.startsAt,
      endDateTime:   payload.endsAt,
      timezone:      payload.timezone,
      attendeeEmail: payload.visitorEmail,
      location:      payload.location,
      conferenceUrl: payload.meetingUrl,
    });
    console.log(`[GCal] STEP 6 Google event created id=${event.id} url=${event.htmlLink}`);

    // 7. Persist event ID on the booking
    const { error: updateErr } = await this.db
      .from("appointment_bookings")
      .update({
        google_event_id:    event.id,
        google_calendar_id: "primary",
        updated_at:         new Date().toISOString(),
      })
      .eq("id", payload.bookingId)
      .eq("user_id", payload.userId);
    if (updateErr) console.error(`[GCal] STEP 7 booking update error:`, updateErr.message);
    else console.log(`[GCal] STEP 7 booking updated with google_event_id`);

    // 8. Record success in history
    void this.db.from("appointment_booking_history").insert({
      booking_id: payload.bookingId,
      user_id:    payload.userId,
      event_type: "google_synced",
      actor:      "system",
      actor_id:   null,
      payload:    { google_event_id: event.id, google_event_url: event.htmlLink },
    }).then();
    console.log(`[GCal] STEP 8 history recorded`);

    // 9. Update connection last_sync
    await this.repo.updateSyncStatus(payload.userId, "success", new Date().toISOString(), null);
    console.log(`[GCal] STEP 9 sync status updated to success`);
  }

  private _buildDescription(p: SyncBookingPayload): string {
    const lines: string[] = [
      `Visitante: ${p.visitorName}`,
      `Email: ${p.visitorEmail}`,
    ];

    if (p.visitorPhone) lines.push(`Telefone: ${p.visitorPhone}`);
    if (p.visitorNotes) lines.push(`\nObservações: ${p.visitorNotes}`);

    // Custom form responses
    const customEntries = Object.entries(p.customFormResponses).filter(
      ([k]) => !k.startsWith("_")   // skip internal fields like _company, _role
    );
    if (customEntries.length > 0) {
      lines.push("\nRespostas do formulário:");
      for (const [k, v] of customEntries) {
        if (v != null && v !== "") lines.push(`  ${k}: ${String(v)}`);
      }
    }

    // Internal meta
    if (p.meetingUrl)  lines.push(`\nLink da reunião: ${p.meetingUrl}`);
    if (p.correlationId) lines.push(`Correlation ID: ${p.correlationId}`);

    return lines.join("\n");
  }
}
