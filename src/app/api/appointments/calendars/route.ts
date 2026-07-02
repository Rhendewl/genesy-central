import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { CalendarService } from "@/lib/appointments/calendar-service";
import { validateNewCalendar, firstError } from "@/lib/appointments/validators";
import type { NewAppointmentCalendar } from "@/types/appointments";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const svc    = new CalendarService(supabase);
  const result = await svc.listCalendars(user.id);

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ calendars: result.data });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json() as Partial<NewAppointmentCalendar>;

  // Validate before passing to the service
  const validation = validateNewCalendar(body);
  if (!validation.ok) {
    return NextResponse.json(
      { error: firstError(validation), details: validation.errors },
      { status: 400 },
    );
  }

  const payload: NewAppointmentCalendar = {
    name:                  body.name!.trim(),
    slug:                  body.slug?.trim() ?? "",
    description:           body.description          ?? null,
    duration_minutes:      body.duration_minutes      ?? 30,
    location_type:         body.location_type         ?? null,
    location:              body.location              ?? null,
    meeting_provider:      body.meeting_provider      ?? "none",
    custom_meeting_url:    body.custom_meeting_url    ?? null,
    timezone:              body.timezone              ?? "America/Sao_Paulo",
    booking_window_days:   body.booking_window_days   ?? 60,
    min_notice_hours:      body.min_notice_hours      ?? 1,
    buffer_before_minutes: body.buffer_before_minutes ?? 0,
    buffer_after_minutes:  body.buffer_after_minutes  ?? 0,
    daily_limit:           body.daily_limit           ?? null,
    status:                "active",
    custom_fields:         body.custom_fields         ?? [],
    settings:              body.settings              ?? {},
  };

  const svc    = new CalendarService(supabase);
  const result = await svc.createCalendar(user.id, payload);

  if (!result.ok) {
    const status = result.errorCode === "CONFLICT" ? 409 : result.errorCode === "SERVER_ERROR" ? 500 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ calendar: result.data }, { status: 201 });
}
