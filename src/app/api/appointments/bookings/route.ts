// GET /api/appointments/bookings
// Auth required. Lists bookings for the authenticated user with optional filters.

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { BookingRepository }          from "@/lib/appointments/repositories/booking-repository";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const url        = new URL(req.url);
  const calendarId = url.searchParams.get("calendar_id") ?? undefined;
  const status     = url.searchParams.get("status")      ?? undefined;
  const fromDate   = url.searchParams.get("from_date")   ?? undefined;
  const toDate     = url.searchParams.get("to_date")     ?? undefined;
  const search     = url.searchParams.get("search")      ?? undefined;
  const limit      = Math.min(parseInt(url.searchParams.get("limit")  ?? "100"), 200);
  const offset     = Math.max(parseInt(url.searchParams.get("offset") ?? "0"),   0);

  try {
    const repo = new BookingRepository(supabase);
    const { data, total } = await repo.listForUser(user.id, {
      calendarId, status, fromDate, toDate, search, limit, offset,
    });
    return NextResponse.json({ bookings: data, total });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
