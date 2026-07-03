// GET /api/agendar/[slug]/slots?date=YYYY-MM-DD
// Public — no auth required. Returns available slots for a given date.

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient }  from "@/lib/supabase-admin";
import { CalendarRepository }         from "@/lib/appointments/repositories/calendar-repository";
import { AvailabilityService }        from "@/lib/appointments/availability-service";

type Params = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { slug } = await params;

  const dateStr = new URL(req.url).searchParams.get("date");
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: "Parâmetro 'date' obrigatório (YYYY-MM-DD)" }, { status: 400 });
  }

  try {
    const db       = createAdminSupabaseClient();
    const calRepo  = new CalendarRepository(db);
    const calendar = await calRepo.findBySlugPublic(slug);

    if (!calendar) {
      return NextResponse.json({ error: "Calendário não encontrado" }, { status: 404 });
    }

    // AvailabilityService.getAvailableSlots requires calendarId + userId.
    // With admin client, RLS is bypassed; userId is used only as a filter param.
    const svc    = new AvailabilityService(db);
    const result = await svc.getAvailableSlots(calendar.id, calendar.user_id, dateStr);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ slots: result.data }, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (err) {
    console.error("[agendar/slots] GET error:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
