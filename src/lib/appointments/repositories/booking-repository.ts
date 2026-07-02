import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreatePublicBookingPayload, PublicBookingResult } from "@/types/appointments";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export interface BookingConflictRow {
  starts_at: string;
  ends_at:   string;
}

export interface CreateBookingRow {
  calendar_id:          string;
  user_id:              string;
  organizer_id:         string;
  visitor_name:         string;
  visitor_email:        string;
  visitor_phone:        string | null;
  visitor_notes:        string | null;
  visitor_timezone:     string;
  starts_at:            string;
  ends_at:              string;
  status:               "pending";
  location_type:        string | null;
  location:             string | null;
  meeting_url:          string | null;
  cancel_token:         string;
  reschedule_token:     string;
  cancel_token_expires_at:     string;
  reschedule_token_expires_at: string;
  custom_form_responses: Record<string, unknown>;
  attribution:          Record<string, unknown>;
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

  async createBooking(row: CreateBookingRow): Promise<PublicBookingResult> {
    const { data, error } = await this.db
      .from("appointment_bookings")
      .insert(row)
      .select("id, starts_at, ends_at, cancel_token")
      .single();

    if (error) throw new Error(error.message);
    if (!data)  throw new Error("INSERT returned no data");

    return {
      booking_id:   data.id as string,
      starts_at:    data.starts_at as string,
      ends_at:      data.ends_at as string,
      cancel_token: data.cancel_token as string,
    };
  }
}
