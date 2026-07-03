// POST /api/agendar/[slug]/book
// Public — no auth required. Creates a booking on the calendar.
// Input validation → slot availability check → DB insert (GIST exclusion handles races).

import { NextRequest, NextResponse }     from "next/server";
import { createAdminSupabaseClient }      from "@/lib/supabase-admin";
import { CalendarRepository }             from "@/lib/appointments/repositories/calendar-repository";
import { BookingService }                 from "@/lib/appointments/booking-service";
import { GoogleCalendarSyncService }      from "@/lib/google-calendar";
import type { CreatePublicBookingPayload } from "@/types/appointments";

type Params = { params: Promise<{ slug: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params;

  const body = await req.json().catch(() => null) as CreatePublicBookingPayload | null;
  if (!body) {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  // Collect attribution signals from the request
  const ip        = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined;
  const userAgent = req.headers.get("user-agent") ?? undefined;
  const referer   = req.headers.get("referer") ?? undefined;

  const payload: CreatePublicBookingPayload = {
    ...body,
    attribution: {
      ...body.attribution,
      ip,
      user_agent: userAgent,
      page_url:   referer,
    },
  };

  try {
    const db       = createAdminSupabaseClient();
    const calRepo  = new CalendarRepository(db);
    const calendar = await calRepo.findBySlugPublic(slug);

    if (!calendar) {
      return NextResponse.json({ error: "Calendário não encontrado" }, { status: 404 });
    }

    const svc    = new BookingService(db);
    const result = await svc.createPublicBooking(calendar, payload);

    if (!result.ok) {
      const status =
        result.errorCode === "CONFLICT"   ? 409 :
        result.errorCode === "VALIDATION" ? 422 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }

    // Sync to Google Calendar — awaited so Vercel doesn't kill the process before it completes.
    // syncBooking() is non-throwing; failure is logged internally and never blocks the response.
    await new GoogleCalendarSyncService(db).syncBooking({
      bookingId:           result.data!.booking_id,
      calendarId:          calendar.id,
      calendarName:        calendar.name,
      userId:              calendar.user_id,
      visitorName:         payload.visitor_name.trim(),
      visitorEmail:        payload.visitor_email.trim().toLowerCase(),
      visitorPhone:        payload.visitor_phone?.trim()  ?? null,
      visitorNotes:        payload.visitor_notes?.trim()  ?? null,
      startsAt:            new Date(payload.starts_at).toISOString(),
      endsAt:              new Date(new Date(payload.starts_at).getTime() + calendar.duration_minutes * 60000).toISOString(),
      timezone:            calendar.timezone,
      meetingUrl:          calendar.custom_meeting_url    ?? null,
      location:            calendar.location              ?? null,
      customFormResponses: payload.custom_form_responses  ?? {},
      correlationId:       null,
    });

    return NextResponse.json({ booking: result.data }, { status: 201 });
  } catch (err) {
    console.error("[agendar/book] POST error:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
