import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AppointmentCalendar,
  NewAppointmentCalendar,
  UpdateAppointmentCalendar,
  PublicCalendar,
} from "@/types/appointments";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export class CalendarRepository {
  constructor(private readonly db: Db) {}

  async listByUser(userId: string): Promise<AppointmentCalendar[]> {
    const { data, error } = await this.db
      .from("appointment_calendars")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as AppointmentCalendar[];
  }

  async findById(id: string, userId: string): Promise<AppointmentCalendar | null> {
    const { data, error } = await this.db
      .from("appointment_calendars")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return (data as AppointmentCalendar) ?? null;
  }

  async findBySlug(userId: string, slug: string): Promise<AppointmentCalendar | null> {
    const { data, error } = await this.db
      .from("appointment_calendars")
      .select("*")
      .eq("user_id", userId)
      .eq("slug", slug)
      .eq("status", "active")
      .maybeSingle();

    if (error) throw new Error(error.message);
    return (data as AppointmentCalendar) ?? null;
  }

  async create(userId: string, payload: NewAppointmentCalendar): Promise<AppointmentCalendar> {
    const { data, error } = await this.db
      .from("appointment_calendars")
      .insert({ ...payload, user_id: userId })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as AppointmentCalendar;
  }

  async update(
    id: string,
    userId: string,
    payload: UpdateAppointmentCalendar,
  ): Promise<AppointmentCalendar> {
    const { data, error } = await this.db
      .from("appointment_calendars")
      .update(payload)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("NOT_FOUND");
    return data as AppointmentCalendar;
  }

  async archive(id: string, userId: string): Promise<void> {
    const { error } = await this.db
      .from("appointment_calendars")
      .update({ status: "archived" })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
  }

  // findBySlugPublic — bypasses user_id filter (caller must use admin/service client).
  // Returns only public-safe fields to avoid leaking internal data.
  async findBySlugPublic(slug: string): Promise<(PublicCalendar & { user_id: string }) | null> {
    const { data, error } = await this.db
      .from("appointment_calendars")
      .select(
        "id, user_id, name, slug, description, duration_minutes, timezone, " +
        "meeting_provider, location_type, location, custom_meeting_url, " +
        "booking_window_days, min_notice_hours, capacity_per_slot, " +
        "custom_fields, settings",
      )
      .eq("slug", slug)
      .eq("status", "active")
      .maybeSingle();

    if (error) throw new Error(error.message);
    return (data as (PublicCalendar & { user_id: string }) | null) ?? null;
  }

  async slugExists(userId: string, slug: string, excludeId?: string): Promise<boolean> {
    let query = this.db
      .from("appointment_calendars")
      .select("id")
      .eq("user_id", userId)
      .eq("slug", slug)
      .eq("status", "active");

    if (excludeId) {
      query = query.neq("id", excludeId);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);
    return data !== null;
  }
}
