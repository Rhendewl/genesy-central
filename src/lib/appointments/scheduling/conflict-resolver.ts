// ── ConflictResolver ──────────────────────────────────────────────────────────
// Pure function. Filters candidate slots by removing any that overlap with
// existing bookings. Existing bookings are passed in — this function does
// not query the database.

import type { CandidateSlot } from "./slot-generator";

export interface ExistingBookingWindow {
  startsAt: Date;
  endsAt:   Date;
}

// Returns only slots that do not conflict with any existing booking.
export function filterConflicts(
  candidates:       CandidateSlot[],
  existingBookings: ExistingBookingWindow[],
): CandidateSlot[] {
  if (existingBookings.length === 0) return candidates;

  return candidates.filter(slot => !hasConflict(slot, existingBookings));
}

function hasConflict(
  slot:    CandidateSlot,
  bookings: ExistingBookingWindow[],
): boolean {
  // Two intervals [A, B) and [C, D) overlap when A < D && C < B
  return bookings.some(
    b => slot.startsAt < b.endsAt && b.startsAt < slot.endsAt,
  );
}

// Parse booking rows from the DB into ExistingBookingWindow objects.
// Input rows come from appointment_bookings with timestamptz strings.
export function parseBookingWindows(
  rows: Array<{ starts_at: string; ends_at: string }>,
): ExistingBookingWindow[] {
  return rows.map(r => ({
    startsAt: new Date(r.starts_at),
    endsAt:   new Date(r.ends_at),
  }));
}
