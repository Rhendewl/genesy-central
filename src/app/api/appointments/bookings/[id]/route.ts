// GET  /api/appointments/bookings/[id] → { history: AppointmentBookingHistory[] }
// PATCH /api/appointments/bookings/[id] → update booking status
// Auth required.

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { BookingRepository }          from "@/lib/appointments/repositories/booking-repository";
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

    return NextResponse.json({ booking });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
