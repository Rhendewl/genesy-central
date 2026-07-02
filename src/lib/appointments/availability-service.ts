// ── AvailabilityService ───────────────────────────────────────────────────────
// Manages the availability aggregate for a Calendar:
//   - Weekly availability rules (what days/hours the calendar is open)
//   - Date-specific exceptions (blocked days, custom hours)
//   - Slot generation (which concrete times are available for a given date)
//
// Responsibility separation from CalendarService (which handles CRUD):
//   CalendarService  → Calendar lifecycle (create, update, archive)
//   AvailabilityService → Availability schedule + slot queries
//
// Slot generation wires up the Scheduling Engine with real booking data to
// produce conflict-free, notice-enforced slot lists.

import type { SupabaseClient } from "@supabase/supabase-js";
import { AvailabilityRepository }  from "./repositories/availability-repository";
import { CalendarRepository }      from "./repositories/calendar-repository";
import { BookingRepository }       from "./repositories/booking-repository";
import { getAvailableSlots }       from "./scheduling";
import { localTimeToUTC }          from "./scheduling/timezone-resolver";
import {
  validateAvailabilityRules,
  validateAvailabilityException,
  firstError,
} from "./validators";
import type { ServiceResult }           from "./calendar-service";
import type {
  AppointmentAvailabilityRule,
  AppointmentAvailabilityException,
  NewAppointmentAvailabilityRule,
  NewAppointmentAvailabilityException,
  AdminSlot,
} from "@/types/appointments";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export class AvailabilityService {
  private readonly availability: AvailabilityRepository;
  private readonly calendars:    CalendarRepository;
  private readonly bookings:     BookingRepository;

  constructor(db: Db) {
    this.availability = new AvailabilityRepository(db);
    this.calendars    = new CalendarRepository(db);
    this.bookings     = new BookingRepository(db);
  }

  // ── Rules ─────────────────────────────────────────────────────────────────

  async getRules(
    calendarId: string,
    userId:     string,
  ): Promise<ServiceResult<AppointmentAvailabilityRule[]>> {
    try {
      const data = await this.availability.getRules(calendarId, userId);
      return { ok: true, data, error: null };
    } catch (err) {
      return { ok: false, data: null, error: err instanceof Error ? err.message : "Erro" };
    }
  }

  async upsertRules(
    calendarId: string,
    userId:     string,
    rules:      NewAppointmentAvailabilityRule[],
  ): Promise<ServiceResult<AppointmentAvailabilityRule[]>> {
    // Validate payload before hitting the DB
    const validation = validateAvailabilityRules(rules);
    if (!validation.ok) {
      return { ok: false, data: null, error: firstError(validation), errorCode: "VALIDATION" };
    }

    try {
      // Note: the RPC function itself checks calendar ownership via auth.uid().
      // We still call CalendarRepository.findById so we can return a friendlier
      // error message before the RPC even fires.
      const calendar = await this.calendars.findById(calendarId, userId);
      if (!calendar) return { ok: false, data: null, error: "Calendário não encontrado", errorCode: "NOT_FOUND" };

      const data = await this.availability.upsertRules(calendarId, rules);
      return { ok: true, data, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      if (msg === "CALENDAR_NOT_FOUND") return { ok: false, data: null, error: "Calendário não encontrado", errorCode: "NOT_FOUND" };
      return { ok: false, data: null, error: msg, errorCode: "SERVER_ERROR" };
    }
  }

  // ── Exceptions ────────────────────────────────────────────────────────────

  async getExceptions(
    calendarId: string,
    userId:     string,
    fromDate?:  string,
    toDate?:    string,
  ): Promise<ServiceResult<AppointmentAvailabilityException[]>> {
    try {
      const data = await this.availability.getExceptions(calendarId, userId, fromDate, toDate);
      return { ok: true, data, error: null };
    } catch (err) {
      return { ok: false, data: null, error: err instanceof Error ? err.message : "Erro" };
    }
  }

  async createException(
    calendarId: string,
    userId:     string,
    payload:    NewAppointmentAvailabilityException,
  ): Promise<ServiceResult<AppointmentAvailabilityException>> {
    const validation = validateAvailabilityException(payload);
    if (!validation.ok) {
      return { ok: false, data: null, error: firstError(validation), errorCode: "VALIDATION" };
    }

    try {
      const calendar = await this.calendars.findById(calendarId, userId);
      if (!calendar) return { ok: false, data: null, error: "Calendário não encontrado", errorCode: "NOT_FOUND" };

      const data = await this.availability.createException(calendarId, userId, payload);
      return { ok: true, data, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      if (msg.includes("unique") || msg.includes("duplicate") || msg.includes("23505")) {
        return { ok: false, data: null, error: "Já existe uma exceção para esta data", errorCode: "CONFLICT" };
      }
      return { ok: false, data: null, error: msg, errorCode: "SERVER_ERROR" };
    }
  }

  async deleteException(
    id:         string,
    calendarId: string,
    userId:     string,
  ): Promise<ServiceResult> {
    try {
      await this.availability.deleteException(id, calendarId, userId);
      return { ok: true, data: null, error: null };
    } catch (err) {
      return { ok: false, data: null, error: err instanceof Error ? err.message : "Erro" };
    }
  }

  // ── Slot generation ───────────────────────────────────────────────────────
  // Layer 1 (application): ConflictResolver filters against real bookings.
  // Layer 2 (database): EXCLUDE USING gist prevents concurrent duplicates.

  async getAvailableSlots(
    calendarId: string,
    userId:     string,
    dateStr:    string,    // "YYYY-MM-DD" in calendar timezone
  ): Promise<ServiceResult<AdminSlot[]>> {
    try {
      const calendar = await this.calendars.findById(calendarId, userId);
      if (!calendar) return { ok: false, data: null, error: "Calendário não encontrado", errorCode: "NOT_FOUND" };

      // Compute window boundaries in UTC so we can fetch only relevant bookings
      const [rules, exceptions] = await Promise.all([
        this.availability.getRules(calendarId, userId),
        this.availability.getExceptions(calendarId, userId, dateStr, dateStr),
      ]);

      // Compute the widest possible UTC window for the requested local date:
      // local midnight → local midnight+1 day (covers DST transitions too)
      const dayStartUtc = localTimeToUTC(dateStr, "00:00", calendar.timezone);
      const dayEndUtc   = new Date(dayStartUtc.getTime() + 25 * 60 * 60 * 1000); // +25h covers DST

      // Real booking conflict data — Layer 1 protection
      const existingBookingRows = await this.bookings.getActiveBookingsForRange(
        calendarId,
        userId,
        dayStartUtc,
        dayEndUtc,
      );

      const slots = getAvailableSlots({
        calendar,
        dateStr,
        rules,
        exceptions,
        existingBookingRows,
      });

      return { ok: true, data: slots, error: null };
    } catch (err) {
      return { ok: false, data: null, error: err instanceof Error ? err.message : "Erro" };
    }
  }
}
