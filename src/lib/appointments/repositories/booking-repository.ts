import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AppointmentBooking,
  AppointmentBookingHistory,
  BookingStatus,
  BookingCancelledBy,
  BookingWithCalendar,
  CreatePublicBookingPayload,
  PublicBookingResult,
} from "@/types/appointments";

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

  async listForUser(
    userId: string,
    filters?: {
      calendarId?: string;
      status?:     string;
      fromDate?:   string;
      toDate?:     string;
      search?:     string;
      limit?:      number;
      offset?:     number;
    },
  ): Promise<{ data: BookingWithCalendar[]; total: number }> {
    let query = this.db
      .from("appointment_bookings")
      .select("*, appointment_calendars(name)", { count: "exact" })
      .eq("user_id", userId)
      .order("starts_at", { ascending: false });

    if (filters?.calendarId) query = query.eq("calendar_id", filters.calendarId);
    if (filters?.status)     query = query.eq("status", filters.status);
    if (filters?.fromDate)   query = query.gte("starts_at", `${filters.fromDate}T00:00:00.000Z`);
    if (filters?.toDate)     query = query.lte("starts_at", `${filters.toDate}T23:59:59.999Z`);
    if (filters?.search) {
      const s = filters.search.trim().replace(/[%_]/g, "\\$&");
      query = query.or(`visitor_name.ilike.%${s}%,visitor_email.ilike.%${s}%,visitor_phone.ilike.%${s}%`);
    }

    const limit  = Math.min(filters?.limit  ?? 100, 200);
    const offset = Math.max(filters?.offset ?? 0, 0);
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    return {
      data: rows.map(row => ({
        ...(row as unknown as AppointmentBooking),
        calendar_name: (row.appointment_calendars as { name: string } | null)?.name ?? "—",
      })),
      total: count ?? 0,
    };
  }

  async getById(id: string, userId: string): Promise<AppointmentBooking | null> {
    const { data, error } = await this.db
      .from("appointment_bookings")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();
    if (error) return null;
    return data as unknown as AppointmentBooking;
  }

  async updateStatus(
    id:     string,
    userId: string,
    status: BookingStatus,
    extra?: { cancelledBy?: BookingCancelledBy; cancellationReason?: string },
  ): Promise<AppointmentBooking> {
    const now   = new Date().toISOString();
    const patch: Record<string, unknown> = { status, updated_at: now };

    if (status === "confirmed")  patch.confirmed_at = now;
    if (status === "cancelled") {
      patch.cancelled_at = now;
      if (extra?.cancelledBy)        patch.cancelled_by         = extra.cancelledBy;
      if (extra?.cancellationReason) patch.cancellation_reason  = extra.cancellationReason;
    }
    if (status === "completed")  patch.completed_at = now;

    const { data, error } = await this.db
      .from("appointment_bookings")
      .update(patch)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!data)  throw new Error("Agendamento não encontrado");
    return data as unknown as AppointmentBooking;
  }

  async getHistory(bookingId: string, userId: string): Promise<AppointmentBookingHistory[]> {
    const { data, error } = await this.db
      .from("appointment_booking_history")
      .select("*")
      .eq("booking_id", bookingId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as AppointmentBookingHistory[];
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
