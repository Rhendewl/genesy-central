// GET /api/agendar/[slug]
// Public — no auth required. Uses admin client to bypass RLS.
// Returns calendar public info + weekdays that have availability rules.

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { CalendarRepository }       from "@/lib/appointments/repositories/calendar-repository";
import { AvailabilityRepository }   from "@/lib/appointments/repositories/availability-repository";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { slug } = await params;

  try {
    const db       = createAdminSupabaseClient();
    const calRepo  = new CalendarRepository(db);
    const calendar = await calRepo.findBySlugPublic(slug);

    if (!calendar) {
      return NextResponse.json({ error: "Calendário não encontrado" }, { status: 404 });
    }

    // Fetch rules to determine which weekdays have availability
    const availRepo = new AvailabilityRepository(db);
    const rules     = await availRepo.getRules(calendar.id, calendar.user_id);

    const availableWeekdays = Array.from(
      new Set(rules.filter(r => r.is_available).map(r => r.day_of_week)),
    ).sort();

    // Strip user_id and sensitive integration tokens before sending to client
    const { user_id: _, ...publicCalendar } = calendar;

    if (publicCalendar.settings?.meta_pixel) {
      const { access_token: _t, ...safeMeta } = publicCalendar.settings.meta_pixel;
      publicCalendar.settings = { ...publicCalendar.settings, meta_pixel: { ...safeMeta, access_token: "" } };
    }

    return NextResponse.json(
      { calendar: publicCalendar, available_weekdays: availableWeekdays },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  } catch (err) {
    console.error("[agendar/route] GET error:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
