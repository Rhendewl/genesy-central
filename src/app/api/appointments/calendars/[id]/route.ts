import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { CalendarService } from "@/lib/appointments/calendar-service";
import { validateUpdateCalendar, firstError } from "@/lib/appointments/validators";
import type { UpdateAppointmentCalendar } from "@/types/appointments";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const svc    = new CalendarService(supabase);
  const result = await svc.getCalendar(id, user.id);

  if (!result.ok) {
    const status = result.error === "Calendário não encontrado" ? 404 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ calendar: result.data });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json() as Partial<UpdateAppointmentCalendar>;

  // Build the allowed-field-only update payload
  const allowed: (keyof UpdateAppointmentCalendar)[] = [
    "name", "slug", "description", "status",
    "duration_minutes", "timezone", "booking_window_days", "min_notice_hours",
    "capacity_per_slot", "buffer_before_minutes", "buffer_after_minutes",
    "daily_limit", "location_type", "location", "meeting_provider",
    "custom_meeting_url", "custom_fields", "settings",
  ];

  const payload: UpdateAppointmentCalendar = {};
  for (const key of allowed) {
    if (key in body) (payload as Record<string, unknown>)[key] = body[key];
  }

  const validation = validateUpdateCalendar(payload);
  if (!validation.ok) {
    return NextResponse.json(
      { error: firstError(validation), details: validation.errors },
      { status: 400 },
    );
  }

  const svc    = new CalendarService(supabase);
  const result = await svc.updateCalendar(id, user.id, payload);

  if (!result.ok) {
    const status = result.errorCode === "NOT_FOUND"  ? 404
                 : result.errorCode === "VALIDATION" ? 400
                 : result.errorCode === "CONFLICT"   ? 409
                 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ calendar: result.data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const svc    = new CalendarService(supabase);
  const result = await svc.archiveCalendar(id, user.id);

  if (!result.ok) {
    const status = result.errorCode === "NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true });
}
