// ── BookingService ────────────────────────────────────────────────────────────
// Handles public booking creation.
// Caller is responsible for providing the correct SupabaseClient:
//   - Use createAdminSupabaseClient() for public (unauthenticated) flows.
//   - The DB-level GIST exclusion (btree_gist) handles concurrent race conditions.

import type { SupabaseClient } from "@supabase/supabase-js";
import { BookingRepository } from "./repositories/booking-repository";
import { CalendarRepository } from "./repositories/calendar-repository";
import { AvailabilityRepository } from "./repositories/availability-repository";
import { validateCreateBooking, firstError } from "./validators";
import { getAvailableSlots } from "./scheduling";
import { localTimeToUTC } from "./scheduling/timezone-resolver";
import type { ServiceResult } from "./calendar-service";
import type {
  CreatePublicBookingPayload,
  PublicBookingResult,
  PublicCalendar,
} from "@/types/appointments";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export class BookingService {
  private readonly bookings:     BookingRepository;
  private readonly calendars:    CalendarRepository;
  private readonly availability: AvailabilityRepository;

  constructor(db: Db) {
    this.bookings     = new BookingRepository(db);
    this.calendars    = new CalendarRepository(db);
    this.availability = new AvailabilityRepository(db);
  }

  async createPublicBooking(
    calendar: PublicCalendar & { user_id: string },
    payload:  CreatePublicBookingPayload,
  ): Promise<ServiceResult<PublicBookingResult>> {

    // 1. Validate the payload
    const validation = validateCreateBooking(payload, calendar);
    if (!validation.ok) {
      return { ok: false, data: null, error: firstError(validation), errorCode: "VALIDATION" };
    }

    const startsAt = new Date(payload.starts_at);
    const endsAt   = new Date(startsAt.getTime() + calendar.duration_minutes * 60 * 1000);
    const ownerId  = calendar.user_id;

    // 2. Verify slot is still available (soft check — DB GIST is the hard guard)
    try {
      const dateStr = startsAt.toLocaleDateString("sv-SE", { timeZone: calendar.timezone });

      const [rules, exceptions] = await Promise.all([
        this.availability.getRules(calendar.id, ownerId),
        this.availability.getExceptions(calendar.id, ownerId, dateStr, dateStr),
      ]);

      const dayStartUtc = localTimeToUTC(dateStr, "00:00", calendar.timezone);
      const dayEndUtc   = new Date(dayStartUtc.getTime() + 25 * 60 * 60 * 1000);

      const existingBookingRows = await this.bookings.getActiveBookingsForRange(
        calendar.id, ownerId, dayStartUtc, dayEndUtc,
      );

      // getAvailableSlots expects AppointmentCalendar but PublicCalendar is a subset.
      // Cast is safe because the scheduling engine only reads the fields present in PublicCalendar.
      const available = getAvailableSlots({
        calendar: calendar as Parameters<typeof getAvailableSlots>[0]["calendar"],
        dateStr,
        rules,
        exceptions,
        existingBookingRows,
      });

      const slotExists = available.some(s => s.startsAt === payload.starts_at);
      if (!slotExists) {
        return { ok: false, data: null, error: "Horário não disponível. Escolha outro horário.", errorCode: "CONFLICT" };
      }
    } catch {
      // Non-fatal: proceed and let GIST catch true duplicates
    }

    // 3. Build cancel / reschedule tokens (UUID v4)
    const cancelToken     = crypto.randomUUID();
    const rescheduleToken = crypto.randomUUID();
    const tokenExpiry     = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // 4. Merge extended standard fields into custom_form_responses
    const customFormResponses: Record<string, unknown> = { ...payload.custom_form_responses };
    if (payload.visitor_company) customFormResponses._company = payload.visitor_company;
    if (payload.visitor_role)    customFormResponses._role    = payload.visitor_role;
    if (payload.visitor_city)    customFormResponses._city    = payload.visitor_city;

    // 5. Persist — DB GIST exclusion blocks concurrent duplicates
    try {
      const result = await this.bookings.createBooking({
        calendar_id:          calendar.id,
        user_id:              ownerId,
        organizer_id:         ownerId,
        visitor_name:         payload.visitor_name.trim(),
        visitor_email:        payload.visitor_email.trim().toLowerCase(),
        visitor_phone:        payload.visitor_phone?.trim() || null,
        visitor_notes:        payload.visitor_notes?.trim() || null,
        visitor_timezone:     payload.visitor_timezone,
        starts_at:            startsAt.toISOString(),
        ends_at:              endsAt.toISOString(),
        status:               "pending",
        location_type:        calendar.location_type,
        location:             calendar.location,
        meeting_url:          calendar.custom_meeting_url,
        cancel_token:         cancelToken,
        reschedule_token:     rescheduleToken,
        cancel_token_expires_at:     tokenExpiry,
        reschedule_token_expires_at: tokenExpiry,
        custom_form_responses: customFormResponses,
        attribution:          (payload.attribution ?? {}) as Record<string, unknown>,
      });

      return { ok: true, data: result, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      // GIST exclusion violation code = 23P01 (exclusion_violation)
      if (msg.includes("23P01") || msg.includes("exclusion") || msg.includes("overlaps")) {
        return { ok: false, data: null, error: "Horário não disponível. Escolha outro horário.", errorCode: "CONFLICT" };
      }
      return { ok: false, data: null, error: msg, errorCode: "SERVER_ERROR" };
    }
  }
}
