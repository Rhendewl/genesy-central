// ── GoogleCalendarService ─────────────────────────────────────────────────────
// All direct communication with the Google Calendar API v3.
// Receives a valid (already-refreshed) access_token from the caller.

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export interface CreateEventParams {
  accessToken:     string;
  googleCalendarId: string;   // "primary" or a specific calendar ID
  summary:         string;
  description:     string;
  startDateTime:   string;   // ISO 8601 with timezone offset
  endDateTime:     string;
  timezone:        string;   // IANA timezone (e.g. "America/Sao_Paulo")
  attendeeEmail?:  string;
  location?:       string | null;
  conferenceUrl?:  string | null;
}

export interface GoogleEvent {
  id:       string;
  htmlLink: string;
}

// Three reminders: 3 hours, 1 hour, 10 minutes before the event.
// Using "popup" (native calendar notification) as the spec requires native reminders.
const REMINDERS = {
  useDefault: false,
  overrides: [
    { method: "popup", minutes: 180 },   // 3 hours
    { method: "popup", minutes: 60  },   // 1 hour
    { method: "popup", minutes: 10  },   // 10 minutes
  ],
};

export async function createCalendarEvent(params: CreateEventParams): Promise<GoogleEvent> {
  const {
    accessToken, googleCalendarId, summary, description,
    startDateTime, endDateTime, timezone,
    attendeeEmail, location, conferenceUrl,
  } = params;

  const event: Record<string, unknown> = {
    summary,
    description,
    start: { dateTime: startDateTime, timeZone: timezone },
    end:   { dateTime: endDateTime,   timeZone: timezone },
    reminders: REMINDERS,
  };

  if (attendeeEmail) {
    event.attendees = [{ email: attendeeEmail }];
  }

  if (location) {
    event.location = location;
  }

  if (conferenceUrl) {
    event.conferenceData = {
      conferenceSolution: { key: { type: "addOn" } },
      entryPoints: [
        { entryPointType: "video", uri: conferenceUrl, label: "Link da reunião" },
      ],
    };
  }

  const url = `${CALENDAR_API}/calendars/${encodeURIComponent(googleCalendarId)}/events` +
    (conferenceUrl ? "?conferenceDataVersion=1" : "");

  const res = await fetch(url, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Calendar event creation failed (${res.status}): ${err}`);
  }

  const data = await res.json() as { id: string; htmlLink: string };
  return { id: data.id, htmlLink: data.htmlLink };
}

export async function deleteCalendarEvent(
  accessToken:      string,
  googleCalendarId: string,
  eventId:          string,
): Promise<void> {
  const url = `${CALENDAR_API}/calendars/${encodeURIComponent(googleCalendarId)}/events/${encodeURIComponent(eventId)}`;
  const res = await fetch(url, {
    method:  "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  // 404 = already deleted — treat as success
  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    throw new Error(`Google Calendar event deletion failed (${res.status}): ${err}`);
  }
}
