import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export interface BookingConflictRow {
  starts_at: string;
  ends_at:   string;
}

export class BookingRepository {
  constructor(private readonly db: Db) {}

  // Fetch all active (pending + confirmed) bookings for a calendar that
  // overlap with the requested time window. Used by the Scheduling Engine
  // to filter out already-occupied slots.
  //
  // Overlap condition: booking.starts_at < windowEnd AND booking.ends_at > windowStart
  // (standard interval overlap — half-open intervals).
  //
  // The userId argument is required for RLS ownership enforcement.
  async getActiveBookingsForRange(
    calendarId:    string,
    userId:        string,
    windowStartUtc: Date,
    windowEndUtc:   Date,
  ): Promise<BookingConflictRow[]> {
    const { data, error } = await this.db
      .from("appointment_bookings")
      .select("starts_at, ends_at")
      .eq("calendar_id", calendarId)
      .eq("user_id", userId)
      .in("status", ["pending", "confirmed"])
      .lt("starts_at", windowEndUtc.toISOString())
      .gt("ends_at",   windowStartUtc.toISOString())
      .order("starts_at", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as BookingConflictRow[];
  }

  // Count confirmed + pending bookings on a specific calendar date (local date).
  // Used to enforce daily_limit. windowStartUtc / windowEndUtc should span
  // the full local day in UTC.
  async countBookingsOnDate(
    calendarId:     string,
    userId:         string,
    dayStartUtc:    Date,
    dayEndUtc:      Date,
  ): Promise<number> {
    const { count, error } = await this.db
      .from("appointment_bookings")
      .select("id", { count: "exact", head: true })
      .eq("calendar_id", calendarId)
      .eq("user_id", userId)
      .in("status", ["pending", "confirmed"])
      .gte("starts_at", dayStartUtc.toISOString())
      .lt("starts_at",  dayEndUtc.toISOString());

    if (error) throw new Error(error.message);
    return count ?? 0;
  }
}
