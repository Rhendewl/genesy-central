// GET  /api/appointments/bookings/[id] → { history: AppointmentBookingHistory[] }
// PATCH /api/appointments/bookings/[id] → update booking status
// Auth required.

import { NextRequest, NextResponse }    from "next/server";
import { createServerSupabaseClient }   from "@/lib/supabase-server";
import { BookingRepository }            from "@/lib/appointments/repositories/booking-repository";
import { GoogleCalendarSyncService }    from "@/lib/google-calendar";
import type { BookingStatus, BookingCancelledBy } from "@/types/appointments";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const repo    = new BookingRepository(supabase);
    const history = await repo.getHistory(id, user.id);
    return NextResponse.json({ history });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

const VALID_TRANSITIONS: Record<string, BookingStatus[]> = {
  pending:     ["confirmed", "cancelled"],
  confirmed:   ["completed", "no_show", "cancelled"],
  cancelled:   [],
  completed:   [],
  no_show:     [],
  rescheduled: ["cancelled"],
};

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    status?: string;
    cancellation_reason?: string;
  } | null;

  const newStatus = body?.status as BookingStatus | undefined;
  if (!newStatus) return NextResponse.json({ error: "Campo 'status' obrigatório" }, { status: 400 });

  try {
    const repo    = new BookingRepository(supabase);
    const current = await repo.getById(id, user.id);

    if (!current) return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });

    const allowed = VALID_TRANSITIONS[current.status] ?? [];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        { error: `Transição inválida: ${current.status} → ${newStatus}` },
        { status: 422 },
      );
    }

    const booking = await repo.updateStatus(id, user.id, newStatus, {
      cancelledBy:         newStatus === "cancelled" ? "admin" as BookingCancelledBy : undefined,
      cancellationReason:  body?.cancellation_reason,
    });

    // Insert history record (non-fatal — .then() required to trigger lazy Supabase execution)
    void supabase.from("appointment_booking_history").insert({
      booking_id: id,
      user_id:    user.id,
      event_type: newStatus,
      actor:      "admin",
      actor_id:   user.id,
      payload:    {
        previous_status: current.status,
        new_status:      newStatus,
        reason:          body?.cancellation_reason ?? null,
      },
    }).then();

    // Trigger Google Calendar sync when booking is confirmed (non-fatal, fire-and-forget)
    if (newStatus === "confirmed") {
      void (async () => {
        try {
          const { data: cal } = await supabase
            .from("appointment_calendars")
            .select("name")
            .eq("id", booking.calendar_id)
            .single();

          const sync = new GoogleCalendarSyncService(supabase);
          await sync.syncBooking({
            bookingId:           booking.id,
            calendarId:          booking.calendar_id,
            calendarName:        cal?.name ?? booking.calendar_id,
            userId:              user.id,
            visitorName:         booking.visitor_name,
            visitorEmail:        booking.visitor_email,
            visitorPhone:        booking.visitor_phone        ?? null,
            visitorNotes:        booking.visitor_notes        ?? null,
            startsAt:            booking.starts_at,
            endsAt:              booking.ends_at,
            timezone:            booking.visitor_timezone,
            meetingUrl:          booking.meeting_url          ?? null,
            location:            booking.location             ?? null,
            customFormResponses: (booking.custom_form_responses as Record<string, unknown>) ?? {},
            correlationId:       booking.correlation_id       ?? null,
          });
        } catch {
          // syncBooking is already non-throwing; this is a belt-and-suspenders catch
        }
      })();
    }

    return NextResponse.json({ booking });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
