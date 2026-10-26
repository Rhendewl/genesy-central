import { afterEach, describe, expect, it, vi } from "vitest";
import { validateCalendarEvent } from "../event-validation";
import { createCalendarEvent, GoogleAuthError } from "../google-calendar-service";

const input = {
  title: " Reunião ", description: "Detalhes", location: "Fortaleza",
  start: "2026-10-27T09:00:00-03:00", end: "2026-10-27T10:00:00-03:00",
  timezone: "America/Fortaleza",
  reminders: [{ method: "popup", minutes: 1440 }, { method: "email", minutes: 120 }],
};

afterEach(() => vi.unstubAllGlobals());

describe("calendar event validation", () => {
  it("accepts custom reminders including the Google limits and no reminders", () => {
    expect(validateCalendarEvent(input).title).toBe("Reunião");
    expect(validateCalendarEvent({ ...input, reminders: [] }).reminders).toEqual([]);
    expect(validateCalendarEvent({ ...input, reminders: [{ method: "popup", minutes: 0 }, { method: "email", minutes: 40320 }] }).reminders).toHaveLength(2);
  });
  it.each([
    { title: "  " }, { end: input.start }, { end: "2026-10-27T08:00:00-03:00" },
    { timezone: "invalid" }, { start: "2026-10-27T09:00:00" },
    { start: "2026-02-30T09:00:00Z" },
    { reminders: Array(6).fill({ method: "popup", minutes: 10 }) },
    { reminders: [{ method: "sms", minutes: 10 }] },
    { reminders: [{ method: "popup", minutes: 40321 }] },
    { reminders: [{ method: "popup", minutes: -1 }] },
    { reminders: [{ method: "popup", minutes: 1.5 }] },
    { reminders: [{ method: "popup", minutes: "10" }] },
  ])("rejects invalid event data: %j", (patch) => {
    expect(() => validateCalendarEvent({ ...input, ...patch })).toThrow();
  });
  it("removes duplicate reminders", () => {
    expect(validateCalendarEvent({ ...input, reminders: [input.reminders[0], input.reminders[0]] }).reminders).toHaveLength(1);
  });
});

const params = {
  accessToken: "test-token", googleCalendarId: "primary", summary: "Reunião",
  description: "Detalhes", startDateTime: input.start, endDateTime: input.end,
  timezone: input.timezone,
};

describe("Google event creation", () => {
  it("sends custom reminders and timezone to Google and returns the saved event", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "saved", htmlLink: "https://calendar.google.com/event" })));
    vi.stubGlobal("fetch", fetchMock);
    const reminders = validateCalendarEvent(input).reminders;
    expect(await createCalendarEvent({ ...params, reminders, location: "Fortaleza" })).toEqual({ id: "saved", htmlLink: "https://calendar.google.com/event" });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    expect(JSON.parse(options.body)).toMatchObject({
      start: { dateTime: input.start, timeZone: input.timezone },
      end: { dateTime: input.end, timeZone: input.timezone },
      reminders: { useDefault: false, overrides: reminders }, location: "Fortaleza",
    });
  });
  it("keeps existing booking reminders while allowing explicit removal", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ id: "saved", htmlLink: "url" }))));
    vi.stubGlobal("fetch", fetchMock);
    await createCalendarEvent(params);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).reminders.overrides.map((r: { minutes: number }) => r.minutes)).toEqual([180, 60, 10]);
    await createCalendarEvent({ ...params, reminders: [] });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).reminders).toEqual({ useDefault: false, overrides: [] });
  });
  it("reports expired authorization and never claims a failed creation succeeded", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 })));
    await expect(createCalendarEvent(params)).rejects.toBeInstanceOf(GoogleAuthError);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })));
    await expect(createCalendarEvent(params)).rejects.toThrow("503");
  });
});
