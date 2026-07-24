// GET /api/google-calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD
// Auth required. Read-only mirror of the user's primary Google Calendar,
// used by the Dashboard "Agenda Semanal" panel.
//
// Not connected / inactive / refresh token revoked → 200 {connected:false, events:[]}
// (an expected state for the empty-state UI, not an error).

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { GoogleTokenService }        from "@/lib/google-calendar/google-token-service";
import { listCalendarEvents, GoogleAuthError, type RawGoogleEvent } from "@/lib/google-calendar/google-calendar-service";
import type { NormalizedCalendarEvent, CalendarEventsResponse } from "@/types/google-calendar";

function normalizeEvent(raw: RawGoogleEvent): NormalizedCalendarEvent {
  return {
    id:          raw.id,
    title:       raw.summary ?? "(Sem título)",
    description: raw.description ?? null,
    location:    raw.location ?? null,
    htmlLink:    raw.htmlLink,
    start:       raw.start.dateTime ?? raw.start.date ?? "",
    end:         raw.end.dateTime   ?? raw.end.date   ?? "",
    isAllDay:    !!raw.start.date,
    timezone:    raw.start.timeZone ?? null,
    attendees: (raw.attendees ?? []).map((a) => ({
      email:          a.email,
      name:           a.displayName ?? null,
      responseStatus: a.responseStatus ?? null,
      isSelf:         !!a.self,
    })),
  };
}

function calendarResponse(body: CalendarEventsResponse, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
      Pragma:          "no-cache",
      Expires:         "0",
    },
  });
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const url  = new URL(req.url);
  const from = url.searchParams.get("from");
  const to   = url.searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "Parâmetros 'from' e 'to' obrigatórios" }, { status: 400 });
  }

  try {
    const tokenService = new GoogleTokenService(supabase);
    const accessToken  = await tokenService.getValidAccessToken(user.id);

    const raw = await listCalendarEvents({
      accessToken,
      timeMin: `${from}T00:00:00Z`,
      timeMax: `${to}T23:59:59Z`,
    });

    const events = raw.map(normalizeEvent);
    return calendarResponse({ connected: true, events });
  } catch (err) {
    if (err instanceof GoogleAuthError) {
      return calendarResponse({ connected: false, events: [] });
    }
    const msg = err instanceof Error ? err.message : "Erro interno";
    return calendarResponse({ connected: true, events: [], error: msg }, 500);
  }
}
