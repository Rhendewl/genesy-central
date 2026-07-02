import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AppointmentAvailabilityRule,
  AppointmentAvailabilityException,
  NewAppointmentAvailabilityRule,
  NewAppointmentAvailabilityException,
} from "@/types/appointments";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export class AvailabilityRepository {
  constructor(private readonly db: Db) {}

  // ── Rules (weekly schedule) ────────────────────────────────────────────────

  async getRules(calendarId: string, userId: string): Promise<AppointmentAvailabilityRule[]> {
    const { data, error } = await this.db
      .from("appointment_availability_rules")
      .select("*")
      .eq("calendar_id", calendarId)
      .eq("user_id", userId)
      .order("day_of_week", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as AppointmentAvailabilityRule[];
  }

  // Replaces the entire weekly schedule atomically via PostgreSQL RPC.
  // The function `appointments_upsert_availability_rules` deletes existing
  // rules and inserts new ones in a single transaction — if the insert fails,
  // the delete is rolled back, leaving the schedule consistent.
  //
  // Ownership check is performed inside the SQL function (via auth.uid()).
  async upsertRules(
    calendarId: string,
    rules:      NewAppointmentAvailabilityRule[],
  ): Promise<AppointmentAvailabilityRule[]> {
    const { data, error } = await this.db.rpc(
      "appointments_upsert_availability_rules",
      {
        p_calendar_id: calendarId,
        p_rules:       rules,
      },
    );

    if (error) {
      // Translate database error codes into readable messages
      const msg = error.message ?? error.code ?? "";
      if (msg.includes("CALENDAR_NOT_FOUND"))  throw new Error("CALENDAR_NOT_FOUND");
      if (msg.includes("UNAUTHENTICATED"))     throw new Error("UNAUTHENTICATED");
      throw new Error(msg);
    }

    return (data ?? []) as AppointmentAvailabilityRule[];
  }

  // ── Exceptions (date-specific overrides) ──────────────────────────────────

  async getExceptions(
    calendarId: string,
    userId:     string,
    fromDate?:  string,
    toDate?:    string,
  ): Promise<AppointmentAvailabilityException[]> {
    let query = this.db
      .from("appointment_availability_exceptions")
      .select("*")
      .eq("calendar_id", calendarId)
      .eq("user_id", userId)
      .order("exception_date", { ascending: true });

    if (fromDate) query = query.gte("exception_date", fromDate);
    if (toDate)   query = query.lte("exception_date", toDate);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as AppointmentAvailabilityException[];
  }

  async createException(
    calendarId: string,
    userId:     string,
    payload:    NewAppointmentAvailabilityException,
  ): Promise<AppointmentAvailabilityException> {
    const { data, error } = await this.db
      .from("appointment_availability_exceptions")
      .insert({ ...payload, calendar_id: calendarId, user_id: userId })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as AppointmentAvailabilityException;
  }

  async deleteException(id: string, calendarId: string, userId: string): Promise<void> {
    const { error } = await this.db
      .from("appointment_availability_exceptions")
      .delete()
      .eq("id", id)
      .eq("calendar_id", calendarId)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
  }

  // Fetch rules + exceptions together — hot path for the Scheduling Engine
  async getAvailabilityForCalendar(
    calendarId: string,
    userId:     string,
    fromDate:   string,
    toDate:     string,
  ): Promise<{
    rules:      AppointmentAvailabilityRule[];
    exceptions: AppointmentAvailabilityException[];
  }> {
    const [rules, exceptions] = await Promise.all([
      this.getRules(calendarId, userId),
      this.getExceptions(calendarId, userId, fromDate, toDate),
    ]);
    return { rules, exceptions };
  }
}
