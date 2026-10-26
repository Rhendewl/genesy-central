// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), token: vi.fn(), create: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/supabase-server", () => ({ createServerSupabaseClient: async () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("../google-token-service", () => ({ GoogleTokenService: class { getValidAccessToken = mocks.token; } }));
vi.mock("../google-calendar-service", async (original) => ({ ...await original<typeof import("../google-calendar-service")>(), createCalendarEvent: mocks.create, listCalendarEvents: mocks.list }));
import { GET, POST } from "@/app/api/google-calendar/events/route";
import { GoogleAuthError } from "../google-calendar-service";
const input = {
  title: "Evento", start: "2026-10-27T12:00:00.000Z", end: "2026-10-27T13:00:00.000Z",
  timezone: "America/Fortaleza", reminders: [{ method: "popup", minutes: 2880 }],
};
const request = (body = JSON.stringify(input)) => new NextRequest("https://app.test/api/google-calendar/events", { method: "POST", body });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "current-user" } } });
  mocks.token.mockResolvedValue("private-token");
  mocks.create.mockResolvedValue({ id: "google-event", htmlLink: "https://calendar.google.com/event" });
});
describe("POST Google calendar events", () => {
  it("creates using only the authenticated user's Google connection", async () => {
    const response = await POST(request(JSON.stringify({ ...input, userId: "someone-else", googleCalendarId: "other-calendar" })));
    expect(response.status).toBe(201);
    expect(mocks.token).toHaveBeenCalledWith("current-user");
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ accessToken: "private-token", googleCalendarId: "primary", reminders: input.reminders }));
    const body = await response.json();
    expect(body.event.id).toBe("google-event");
    expect(JSON.stringify(body)).not.toContain("private-token");
  });
  it("rejects unauthenticated requests without writing", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(request())).status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each(["broken-json", JSON.stringify({ ...input, end: input.start })])("rejects invalid payloads without calling Google", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mocks.token).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("asks to reconnect a revoked or missing Google connection", async () => {
    mocks.token.mockRejectedValueOnce(new GoogleAuthError("revoked"));
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect((await response.json()).reconnect).toBe(true);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("reports provider failure without leaking its response", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.create.mockRejectedValueOnce(new Error("private-provider-response"));
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("private-provider-response");
    log.mockRestore();
  });
});


describe("calendar event refresh", () => {
  it("preserves local day boundaries and the saved reminders when listing events", async () => {
    mocks.list.mockResolvedValueOnce([{
      id: "late-event", summary: "Evento à noite", htmlLink: "url",
      start: { dateTime: "2026-10-28T02:30:00Z", timeZone: "America/Fortaleza" },
      end: { dateTime: "2026-10-28T02:45:00Z" },
      reminders: { useDefault: false, overrides: input.reminders },
    }]);
    const response = await GET(new NextRequest("https://app.test/api/google-calendar/events?from=2026-10-27T03:00:00.000Z&to=2026-10-28T03:00:00.000Z"));
    expect(response.status).toBe(200);
    expect(mocks.list).toHaveBeenCalledWith({ accessToken: "private-token", timeMin: "2026-10-27T03:00:00.000Z", timeMax: "2026-10-28T03:00:00.000Z" });
    expect((await response.json()).events[0].reminders.overrides).toEqual(input.reminders);
  });
});
