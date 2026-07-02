// ── Scheduling Engine — public surface ───────────────────────────────────────
// Composes the 4 pure functions into a single orchestrated call.
// The caller (CalendarService) is responsible for fetching DB data and passing
// it in. This module stays pure: no DB access, no side effects.

import type { AppointmentCalendar } from "@/types/appointments";
import type { AppointmentAvailabilityRule }      from "@/types/appointments";
import type { AppointmentAvailabilityException } from "@/types/appointments";
import type { AdminSlot }                        from "@/types/appointments";

import { resolveAvailability } from "./availability-resolver";
import { generateSlots }       from "./slot-generator";
import { filterConflicts, parseBookingWindows } from "./conflict-resolver";
import { utcToLocalTime, formatDateLabel }       from "./timezone-resolver";

export interface GetAvailableSlotsParams {
  calendar:   AppointmentCalendar;
  dateStr:    string;    // "YYYY-MM-DD" in calendar timezone
  rules:      AppointmentAvailabilityRule[];
  exceptions: AppointmentAvailabilityException[];
  // Raw booking rows for the date — already filtered by caller to only
  // include 'pending' and 'confirmed' bookings.
  existingBookingRows: Array<{ starts_at: string; ends_at: string }>;
  nowUtc?: Date;   // injectable; defaults to new Date()
}

export function getAvailableSlots(params: GetAvailableSlotsParams): AdminSlot[] {
  const {
    calendar, dateStr, rules, exceptions, existingBookingRows,
  } = params;
  const nowUtc = params.nowUtc ?? new Date();

  // 1. Resolve the effective time window for the requested date
  const resolved = resolveAvailability(dateStr, calendar.timezone, rules, exceptions);
  if (!resolved.window) return [];

  // 2. Generate candidate slots within the window
  const candidates = generateSlots({
    dateStr,
    timezone:            calendar.timezone,
    window:              resolved.window,
    durationMinutes:     calendar.duration_minutes,
    bufferBeforeMinutes: calendar.buffer_before_minutes,
    bufferAfterMinutes:  calendar.buffer_after_minutes,
    minNoticeHours:      calendar.min_notice_hours,
    nowUtc,
  });

  // 3. Remove slots that conflict with existing bookings
  const existingWindows = parseBookingWindows(existingBookingRows);
  const available       = filterConflicts(candidates, existingWindows);

  // 4. Annotate each slot with human-readable local times
  return available.map<AdminSlot>(slot => ({
    startsAt:      slot.startsAt.toISOString(),
    endsAt:        slot.endsAt.toISOString(),
    startsAtLocal: utcToLocalTime(slot.startsAt, calendar.timezone),
    dateLabel:     formatDateLabel(slot.startsAt, calendar.timezone),
  }));
}

// Re-export individual pieces for callers that only need them selectively
export { resolveAvailability } from "./availability-resolver";
export { generateSlots }       from "./slot-generator";
export { filterConflicts, parseBookingWindows } from "./conflict-resolver";
export {
  localTimeToUTC,
  utcToLocalTime,
  utcToLocalDate,
  getDayOfWeekInTimezone,
  formatDateLabel,
} from "./timezone-resolver";
