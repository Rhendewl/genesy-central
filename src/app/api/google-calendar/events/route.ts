// GET /api/google-calendar/events?from=ISO&to=ISO (exclusive end); date-only ranges also supported
// GET lists and POST creates events on the authenticated user's primary Google Calendar,
// used by the Dashboard "Agenda Semanal" panel.
//
// Not connected / inactive / refresh token revoked → 200 {connected:false, events:[]}
// (an expected state for the empty-state UI, not an error).

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { GoogleTokenService }        from "@/lib/google-calendar/google-token-service";
import { createCalendarEvent, listCalendarEvents, GoogleAuthError, type RawGoogleEvent } from "@/lib/google-calendar/google-calendar-service";
import { validateCalendarEvent, CalendarValidationError } from "@/lib/google-calendar/event-validation";
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
    reminders:   raw.reminders,
    attendees: (raw.attendees ?? []).map((a) => ({
      email:          a.email,
      name:           a.displayName ?? null,
      responseStatus: a.responseStatus ?? null,
      isSelf:         !!a.self,
    })),
  };
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    let body: unknown;
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Dados do evento inválidos." }, { status: 400 }); }
    const input = validateCalendarEvent(body);
    const accessToken = await new GoogleTokenService(supabase).getValidAccessToken(user.id);
    const event = await createCalendarEvent({
      accessToken,
      googleCalendarId: "primary",
      summary: input.title,
      description: input.description,
      location: input.location,
      startDateTime: input.start,
      endDateTime: input.end,
      timezone: input.timezone,
      reminders: input.reminders,
    });
    return NextResponse.json({ event }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof CalendarValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof GoogleAuthError) {
      return NextResponse.json({ error: "Reconecte sua conta Google para criar o evento.", reconnect: true }, { status: 409 });
    }
    console.error("[google-calendar] Event creation failed", err instanceof Error ? err.message : "Unknown error");
    return NextResponse.json({ error: "Não foi possível confirmar a criação no Google Agenda. Confira sua agenda antes de tentar novamente." }, { status: 502 });
  }
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

  const timeMin = /^\d{4}-\d{2}-\d{2}$/.test(from) ? `${from}T00:00:00Z` : from;
  const timeMax = /^\d{4}-\d{2}-\d{2}$/.test(to) ? `${to}T23:59:59Z` : to;
  if (!Number.isFinite(Date.parse(timeMin)) || !Number.isFinite(Date.parse(timeMax)) || Date.parse(timeMax) <= Date.parse(timeMin)) {
    return NextResponse.json({ error: "Período inválido." }, { status: 400 });
  }

  try {
    const tokenService = new GoogleTokenService(supabase);
    const accessToken  = await tokenService.getValidAccessToken(user.id);

    const raw = await listCalendarEvents({
      accessToken,
      timeMin,
      timeMax,
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
