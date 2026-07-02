// ── SlotGenerator ─────────────────────────────────────────────────────────────
// Pure function. Given a date, the effective time window, the calendar config,
// and the current UTC time, emits all candidate slot start/end times (UTC).
// Does NOT check for booking conflicts — that is ConflictResolver's job.

import type { TimeWindow } from "@/types/appointments";
import { localTimeToUTC } from "./timezone-resolver";

export interface CandidateSlot {
  startsAt: Date;
  endsAt:   Date;
}

export interface GenerateSlotsParams {
  dateStr:              string;    // "YYYY-MM-DD" in calendar timezone
  timezone:             string;    // calendar IANA timezone
  window:               TimeWindow; // "HH:MM" times, inclusive start, exclusive end
  durationMinutes:      number;
  bufferBeforeMinutes:  number;
  bufferAfterMinutes:   number;
  minNoticeHours:       number;
  nowUtc:               Date;      // current UTC reference (injectable for tests)
}

export function generateSlots(params: GenerateSlotsParams): CandidateSlot[] {
  const {
    dateStr, timezone, window, durationMinutes,
    bufferBeforeMinutes, bufferAfterMinutes, minNoticeHours, nowUtc,
  } = params;

  const slots: CandidateSlot[] = [];

  // Minimum booking UTC boundary (now + min_notice_hours)
  const minBookingUtc = new Date(nowUtc.getTime() + minNoticeHours * 60 * 60 * 1000);

  // Window boundaries in UTC
  const windowStartUtc = localTimeToUTC(dateStr, window.startTime, timezone);
  const windowEndUtc   = localTimeToUTC(dateStr, window.endTime,   timezone);

  // Total slot block = buffer_before + duration + buffer_after
  const blockMs       = (bufferBeforeMinutes + durationMinutes + bufferAfterMinutes) * 60 * 1000;
  const durationMs    = durationMinutes * 60 * 1000;
  const bufferBefore  = bufferBeforeMinutes * 60 * 1000;

  let cursor = windowStartUtc.getTime();

  while (cursor + blockMs <= windowEndUtc.getTime()) {
    const slotStartUtc = new Date(cursor + bufferBefore);
    const slotEndUtc   = new Date(slotStartUtc.getTime() + durationMs);

    // Respect min_notice: slot must not start before minBookingUtc
    if (slotStartUtc >= minBookingUtc) {
      slots.push({ startsAt: slotStartUtc, endsAt: slotEndUtc });
    }

    cursor += blockMs;
  }

  return slots;
}
