// ── BookingService ────────────────────────────────────────────────────────────
// Handles booking domain logic and publishes lifecycle events to the EventBus.
// Caller is responsible for providing the correct SupabaseClient:
//   - Use createAdminSupabaseClient() for public (unauthenticated) flows.
//   - Use createServerSupabaseClient() for authenticated admin flows (RLS enforced).
//   - The DB-level GIST exclusion (btree_gist) handles concurrent race conditions.

import type { SupabaseClient }   from "@supabase/supabase-js";
import type { EventBus }         from "@/lib/event-bus/types";
import type { DomainEventType }  from "@/lib/event-bus/domain-events";
import { getPlatformEventBus }   from "@/lib/event-bus/platform";
import { BookingRepository }     from "./repositories/booking-repository";
import { CalendarRepository }    from "./repositories/calendar-repository";
import { AvailabilityRepository } from "./repositories/availability-repository";
import { GoogleCalendarSyncService } from "@/lib/google-calendar";
import { validateCreateBooking, firstError } from "./validators";
import { getAvailableSlots }     from "./scheduling";
import { localTimeToUTC }        from "./scheduling/timezone-resolver";
import type { ServiceResult }    from "./calendar-service";
import type {
  AppointmentBooking,
  BookingStatus,
  BookingCancelledBy,
  CreatePublicBookingPayload,
  PublicBookingResult,
  PublicCalendar,
} from "@/types/appointments";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export class BookingService {
  private readonly db:           Db;
  private readonly bookings:     BookingRepository;
  private readonly calendars:    CalendarRepository;
  private readonly availability: AvailabilityRepository;
  private readonly bus:          EventBus<DomainEventType>;

  constructor(db: Db, bus?: EventBus<DomainEventType>) {
    this.db           = db;
    this.bookings     = new BookingRepository(db);
    this.calendars    = new CalendarRepository(db);
    this.availability = new AvailabilityRepository(db);
    this.bus          = bus ?? getPlatformEventBus();
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

      // Fetch full calendar to get buffer_before/after_minutes (PublicCalendar lacks them)
      const fullCalendar = await this.calendars.findById(calendar.id, ownerId);
      if (!fullCalendar) throw new Error("calendar not found");

      const [rules, exceptions] = await Promise.all([
        this.availability.getRules(calendar.id, ownerId),
        this.availability.getExceptions(calendar.id, ownerId, dateStr, dateStr),
      ]);

      const dayStartUtc = localTimeToUTC(dateStr, "00:00", calendar.timezone);
      const dayEndUtc   = new Date(dayStartUtc.getTime() + 25 * 60 * 60 * 1000);

      const existingBookingRows = await this.bookings.getActiveBookingsForRange(
        calendar.id, ownerId, dayStartUtc, dayEndUtc,
      );

      const available = getAvailableSlots({
        calendar: fullCalendar,
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

      // Insert creation history (non-fatal — .then() required to trigger lazy Supabase execution)
      void this.db.from("appointment_booking_history").insert({
        booking_id: result.booking_id,
        user_id:    ownerId,
        event_type: "created",
        actor:      "visitor",
        actor_id:   null,
        payload: {
          visitor_name:  payload.visitor_name.trim(),
          visitor_email: payload.visitor_email.trim().toLowerCase(),
          calendar_id:   calendar.id,
        },
      }).then();

      // Publish domain event — fire-and-forget; never blocks the booking response.
      this.bus.publish("booking.created", {
        bookingId:    result.booking_id,
        calendarId:   calendar.id,
        userId:       ownerId,
        visitorName:  payload.visitor_name.trim(),
        visitorEmail: payload.visitor_email.trim().toLowerCase(),
        visitorPhone: payload.visitor_phone?.trim() || null,
        startsAt:     startsAt.toISOString(),
        attribution:  (payload.attribution ?? {}) as Record<string, unknown>,
        // O sync CRM (BookingCrmSyncService) ainda não rodou nesta request —
        // leadId só existe a partir dos eventos de status seguintes.
        leadId:       null,
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

  // ── Status transitions ───────────────────────────────────────────────────────

  /**
   * Updates a booking's status and publishes the corresponding lifecycle event
   * to the EventBus when the new status has conversion tracking configured.
   *
   * History insertion (appointment_booking_history) remains the caller's
   * responsibility — that concern belongs at the application layer, not here.
   *
   * To add a new publishable lifecycle event (e.g. booking.completed), extend
   * PUBLISHABLE_STATUS_EVENTS — no other code change required.
   */
  async updateStatus(
    bookingId: string,
    userId:    string,
    newStatus: BookingStatus,
    current:   AppointmentBooking,
    options?:  { cancellationReason?: string },
  ): Promise<ServiceResult<AppointmentBooking>> {
    try {
      const booking = await this.bookings.updateStatus(bookingId, userId, newStatus, {
        cancelledBy:        newStatus === "cancelled" ? ("admin" as BookingCancelledBy) : undefined,
        cancellationReason: options?.cancellationReason,
      });

      // Publish lifecycle events for statuses that have conversion tracking.
      // Map is the extension point: add a new entry to publish future events.
      const PUBLISHABLE_STATUS_EVENTS: Partial<Record<BookingStatus, DomainEventType>> = {
        confirmed: "booking.confirmed",
        completed: "booking.completed",
        cancelled: "booking.cancelled",
        no_show:   "booking.no_show",
      };

      const eventType = PUBLISHABLE_STATUS_EVENTS[newStatus];
      if (eventType) {
        this.bus.publish(eventType, {
          bookingId:    current.id,
          calendarId:   current.calendar_id,
          userId:       current.user_id,
          visitorName:  current.visitor_name,
          visitorEmail: current.visitor_email,
          visitorPhone: current.visitor_phone,
          startsAt:     current.starts_at,
          attribution:  current.attribution as Record<string, unknown>,
          // Por essa altura (confirmação/conclusão/cancelamento, minutos a
          // dias depois da criação), o sync CRM já rodou e populou lead_id —
          // habilita os gatilhos "lead compareceu"/"lead faltou" do Workflow Engine.
          leadId:       current.lead_id,
        });
      }

      return { ok: true, data: booking, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao atualizar status";
      return { ok: false, data: null, error: msg, errorCode: "SERVER_ERROR" };
    }
  }

  // ── Exclusão permanente ────────────────────────────────────────────────────
  //
  // Único lugar que sabe fazer isso — usado tanto pelo DELETE de um agendamento
  // quanto pelo bulk-delete (loop chamando isto pra cada id), sem duplicar a
  // lógica de limpeza do Google Calendar em dois lugares.
  async deleteBooking(id: string, userId: string): Promise<ServiceResult<null>> {
    try {
      const current = await this.bookings.getById(id, userId);
      if (!current) {
        return { ok: false, data: null, error: "Agendamento não encontrado", errorCode: "SERVER_ERROR" };
      }

      // Best-effort: remove o evento do Google Calendar, se sincronizado —
      // nunca bloqueia a exclusão do agendamento em si.
      if (current.google_event_id && current.google_calendar_id) {
        await new GoogleCalendarSyncService(this.db).deleteBookingEvent(
          userId, current.google_calendar_id, current.google_event_id,
        );
      }

      await this.bookings.deleteBooking(id, userId);
      return { ok: true, data: null, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao excluir agendamento";
      return { ok: false, data: null, error: msg, errorCode: "SERVER_ERROR" };
    }
  }
}
