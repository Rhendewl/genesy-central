import { describe, it, expect } from "vitest";

import { localTimeToUTC, utcToLocalTime, utcToLocalDate, getDayOfWeekInTimezone, formatDateLabel } from "../scheduling/timezone-resolver";
import { resolveAvailability } from "../scheduling/availability-resolver";
import { generateSlots } from "../scheduling/slot-generator";
import { filterConflicts, parseBookingWindows } from "../scheduling/conflict-resolver";
import { getAvailableSlots } from "../scheduling";

import type {
  AppointmentAvailabilityRule,
  AppointmentAvailabilityException,
  AppointmentCalendar,
  TimeWindow,
} from "@/types/appointments";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TZ_SP  = "America/Sao_Paulo";   // UTC-3 (no DST since 2019)
const TZ_NY  = "America/New_York";    // UTC-5/UTC-4 (DST in March/November)
const TZ_UTC = "UTC";

function makeRule(
  day_of_week: number,
  start_time:  string,
  end_time:    string,
  is_available = true,
): AppointmentAvailabilityRule {
  return {
    id: `rule-${day_of_week}`,
    calendar_id: "cal-1",
    user_id: "user-1",
    day_of_week,
    start_time,
    end_time,
    is_available,
    created_at: "2026-01-01T00:00:00Z",
  };
}

function makeException(
  exception_date: string,
  type: "blocked" | "custom_hours",
  start_time?: string,
  end_time?: string,
): AppointmentAvailabilityException {
  return {
    id: `exc-${exception_date}`,
    calendar_id: "cal-1",
    user_id: "user-1",
    exception_date,
    type,
    start_time: start_time ?? null,
    end_time:   end_time   ?? null,
    reason:     null,
    created_at: "2026-01-01T00:00:00Z",
  };
}

function makeCalendar(overrides: Partial<AppointmentCalendar> = {}): AppointmentCalendar {
  return {
    id:                    "cal-1",
    user_id:               "user-1",
    name:                  "Test Calendar",
    slug:                  "test-calendar",
    description:           null,
    duration_minutes:      30,
    location_type:         null,
    location:              null,
    meeting_provider:      "none",
    custom_meeting_url:    null,
    timezone:              TZ_SP,
    booking_window_days:   60,
    min_notice_hours:      0,
    capacity_per_slot:     1,
    buffer_before_minutes: 0,
    buffer_after_minutes:  0,
    daily_limit:           null,
    status:                "active",
    custom_fields:         [],
    settings:              {},
    created_at:            "2026-01-01T00:00:00Z",
    updated_at:            "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. TimezoneResolver
// ─────────────────────────────────────────────────────────────────────────────

describe("TimezoneResolver › localTimeToUTC", () => {
  it("converts São Paulo 09:00 to UTC (UTC-3)", () => {
    const utc = localTimeToUTC("2026-07-01", "09:00", TZ_SP);
    expect(utc.toISOString()).toBe("2026-07-01T12:00:00.000Z");
  });

  it("converts São Paulo 17:00 to UTC", () => {
    const utc = localTimeToUTC("2026-07-01", "17:00", TZ_SP);
    expect(utc.toISOString()).toBe("2026-07-01T20:00:00.000Z");
  });

  it("converts UTC midnight correctly", () => {
    const utc = localTimeToUTC("2026-07-01", "00:00", TZ_UTC);
    expect(utc.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });

  it("converts New York 09:00 EST to UTC (UTC-5, winter)", () => {
    // January — New York is UTC-5 (EST)
    const utc = localTimeToUTC("2026-01-15", "09:00", TZ_NY);
    expect(utc.toISOString()).toBe("2026-01-15T14:00:00.000Z");
  });

  it("converts New York 09:00 EDT to UTC (UTC-4, summer)", () => {
    // July — New York is UTC-4 (EDT)
    const utc = localTimeToUTC("2026-07-15", "09:00", TZ_NY);
    expect(utc.toISOString()).toBe("2026-07-15T13:00:00.000Z");
  });

  it("handles DST spring-forward (2026-03-08 is spring-forward Sunday in US)", () => {
    // After 2 AM → clocks jump to 3 AM. 09:00 is well after the gap — should work.
    const utc = localTimeToUTC("2026-03-08", "09:00", TZ_NY);
    // 2026-03-08 09:00 EDT = 2026-03-08 13:00 UTC (UTC-4 after spring forward)
    expect(utc.toISOString()).toBe("2026-03-08T13:00:00.000Z");
  });

  it("handles year boundary Dec 31 → Jan 1", () => {
    const utc = localTimeToUTC("2026-12-31", "23:00", TZ_SP);
    // 2026-12-31 23:00 BRT = 2027-01-01 02:00 UTC
    expect(utc.toISOString()).toBe("2027-01-01T02:00:00.000Z");
  });

  it("handles month boundary", () => {
    const utc = localTimeToUTC("2026-01-31", "23:00", TZ_SP);
    expect(utc.toISOString()).toBe("2026-02-01T02:00:00.000Z");
  });
});

describe("TimezoneResolver › utcToLocalTime", () => {
  it("converts UTC noon to São Paulo 09:00", () => {
    const local = utcToLocalTime(new Date("2026-07-01T12:00:00Z"), TZ_SP);
    expect(local).toBe("09:00");
  });

  it("converts UTC midnight to UTC 00:00", () => {
    const local = utcToLocalTime(new Date("2026-07-01T00:00:00Z"), TZ_UTC);
    expect(local).toBe("00:00");
  });
});

describe("TimezoneResolver › utcToLocalDate", () => {
  it("returns local date in São Paulo timezone", () => {
    // 2026-07-01 01:00 UTC = 2026-06-30 22:00 BRT — previous day in SP
    const local = utcToLocalDate(new Date("2026-07-01T01:00:00Z"), TZ_SP);
    expect(local).toBe("2026-06-30");
  });

  it("returns same date when within local day", () => {
    const local = utcToLocalDate(new Date("2026-07-01T12:00:00Z"), TZ_SP);
    expect(local).toBe("2026-07-01");
  });
});

describe("TimezoneResolver › getDayOfWeekInTimezone", () => {
  it("identifies Monday (1) for 2026-07-06 in SP", () => {
    // 2026-07-06 is a Monday
    expect(getDayOfWeekInTimezone("2026-07-06", TZ_SP)).toBe(1);
  });

  it("identifies Sunday (0) for 2026-07-05 in SP", () => {
    expect(getDayOfWeekInTimezone("2026-07-05", TZ_SP)).toBe(0);
  });

  it("identifies Saturday (6) for 2026-07-04 in SP", () => {
    expect(getDayOfWeekInTimezone("2026-07-04", TZ_SP)).toBe(6);
  });

  it("identifies Friday (5) for 2026-07-03 in SP", () => {
    expect(getDayOfWeekInTimezone("2026-07-03", TZ_SP)).toBe(5);
  });

  it("handles timezone boundary: day may differ from UTC", () => {
    // 2026-07-01 00:30 UTC = 2026-06-30 21:30 BRT (Tuesday June 30 in SP)
    // getDayOfWeekInTimezone uses noon local, not UTC — should give Jul 1 = Wednesday = 3
    expect(getDayOfWeekInTimezone("2026-07-01", TZ_SP)).toBe(3); // Wednesday
  });
});

describe("TimezoneResolver › formatDateLabel", () => {
  it("returns a non-empty string", () => {
    const label = formatDateLabel(new Date("2026-07-06T12:00:00Z"), TZ_SP);
    expect(typeof label).toBe("string");
    expect(label.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. AvailabilityResolver
// ─────────────────────────────────────────────────────────────────────────────

describe("AvailabilityResolver", () => {
  // 2026-07-06 = Monday
  const MON = "2026-07-06";
  // 2026-07-05 = Sunday
  const SUN = "2026-07-05";

  const mondayRule = makeRule(1, "09:00:00", "17:00:00", true);
  const sundayRule = makeRule(0, "09:00:00", "17:00:00", false);

  it("returns windows for available day", () => {
    const result = resolveAvailability(MON, TZ_SP, [mondayRule], []);
    expect(result.windows).toHaveLength(1);
    expect(result.windows[0]).toEqual({ startTime: "09:00", endTime: "17:00" });
    expect(result.source).toBe("rule");
  });

  it("returns empty windows for unavailable day (is_available=false)", () => {
    const result = resolveAvailability(SUN, TZ_SP, [sundayRule], []);
    expect(result.windows).toHaveLength(0);
    expect(result.source).toBe("rule");
  });

  it("returns empty windows when no rule exists for the day", () => {
    const result = resolveAvailability(SUN, TZ_SP, [mondayRule], []);
    expect(result.windows).toHaveLength(0);
    expect(result.source).toBe("rule");
  });

  it("blocked exception overrides an available rule", () => {
    const exc    = makeException(MON, "blocked");
    const result = resolveAvailability(MON, TZ_SP, [mondayRule], [exc]);
    expect(result.windows).toHaveLength(0);
    expect(result.source).toBe("exception");
  });

  it("custom_hours exception overrides weekly rule window", () => {
    const exc    = makeException(MON, "custom_hours", "10:00:00", "14:00:00");
    const result = resolveAvailability(MON, TZ_SP, [mondayRule], [exc]);
    expect(result.windows).toHaveLength(1);
    expect(result.windows[0]).toEqual({ startTime: "10:00", endTime: "14:00" });
    expect(result.source).toBe("exception");
  });

  it("custom_hours exception on an otherwise unavailable day enables it", () => {
    const exc    = makeException(SUN, "custom_hours", "10:00:00", "12:00:00");
    const result = resolveAvailability(SUN, TZ_SP, [sundayRule], [exc]);
    expect(result.windows).toHaveLength(1);
    expect(result.windows[0]).toEqual({ startTime: "10:00", endTime: "12:00" });
    expect(result.source).toBe("exception");
  });

  it("malformed custom_hours exception (missing times) treated as blocked", () => {
    const exc    = makeException(MON, "custom_hours"); // no times
    const result = resolveAvailability(MON, TZ_SP, [mondayRule], [exc]);
    expect(result.windows).toHaveLength(0);
    expect(result.source).toBe("exception");
  });

  it("exception on different date does not affect requested date", () => {
    const exc    = makeException("2026-07-07", "blocked"); // Tuesday
    const result = resolveAvailability(MON, TZ_SP, [mondayRule], [exc]);
    expect(result.windows).toHaveLength(1);
    expect(result.windows[0]).toEqual({ startTime: "09:00", endTime: "17:00" });
    expect(result.source).toBe("rule");
  });

  it("correctly slices HH:MM:SS time strings from DB", () => {
    const rule   = makeRule(1, "09:00:00", "18:30:00"); // full Postgres time format
    const result = resolveAvailability(MON, TZ_SP, [rule], []);
    expect(result.windows).toHaveLength(1);
    expect(result.windows[0]).toEqual({ startTime: "09:00", endTime: "18:30" });
  });

  it("multi-interval: two rules for the same day produce two windows", () => {
    const rule1 = { ...makeRule(1, "09:00:00", "12:00:00"), id: "rule-1a" };
    const rule2 = { ...makeRule(1, "14:00:00", "17:00:00"), id: "rule-1b" };
    const result = resolveAvailability(MON, TZ_SP, [rule1, rule2], []);
    expect(result.windows).toHaveLength(2);
    expect(result.windows[0]).toEqual({ startTime: "09:00", endTime: "12:00" });
    expect(result.windows[1]).toEqual({ startTime: "14:00", endTime: "17:00" });
    expect(result.source).toBe("rule");
  });

  it("multi-interval: windows are sorted by start_time ascending", () => {
    const rule1 = { ...makeRule(1, "14:00:00", "17:00:00"), id: "rule-1b" };
    const rule2 = { ...makeRule(1, "09:00:00", "12:00:00"), id: "rule-1a" };
    const result = resolveAvailability(MON, TZ_SP, [rule1, rule2], []);
    expect(result.windows[0].startTime).toBe("09:00");
    expect(result.windows[1].startTime).toBe("14:00");
  });

  it("multi-interval: blocked exception still returns empty windows", () => {
    const rule1 = { ...makeRule(1, "09:00:00", "12:00:00"), id: "rule-1a" };
    const rule2 = { ...makeRule(1, "14:00:00", "17:00:00"), id: "rule-1b" };
    const exc   = makeException(MON, "blocked");
    const result = resolveAvailability(MON, TZ_SP, [rule1, rule2], [exc]);
    expect(result.windows).toHaveLength(0);
    expect(result.source).toBe("exception");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. SlotGenerator
// ─────────────────────────────────────────────────────────────────────────────

describe("SlotGenerator › generateSlots", () => {
  const window: TimeWindow = { startTime: "09:00", endTime: "17:00" };
  // Fixed reference: far in the past so min_notice never filters slots in tests
  const pastNow = new Date("2020-01-01T00:00:00Z");

  it("generates 16 slots for 09:00-17:00 with 30-min duration, no buffer", () => {
    const slots = generateSlots({
      dateStr:              "2026-07-06",
      timezone:             TZ_SP,
      window,
      durationMinutes:      30,
      bufferBeforeMinutes:  0,
      bufferAfterMinutes:   0,
      minNoticeHours:       0,
      nowUtc:               pastNow,
    });
    expect(slots).toHaveLength(16);
  });

  it("first slot starts at 09:00 SP time", () => {
    const slots = generateSlots({
      dateStr:              "2026-07-06",
      timezone:             TZ_SP,
      window,
      durationMinutes:      30,
      bufferBeforeMinutes:  0,
      bufferAfterMinutes:   0,
      minNoticeHours:       0,
      nowUtc:               pastNow,
    });
    // 09:00 SP = 12:00 UTC
    expect(slots[0].startsAt.toISOString()).toBe("2026-07-06T12:00:00.000Z");
  });

  it("last slot ends before or at window end (17:00 SP = 20:00 UTC)", () => {
    const slots = generateSlots({
      dateStr:              "2026-07-06",
      timezone:             TZ_SP,
      window,
      durationMinutes:      30,
      bufferBeforeMinutes:  0,
      bufferAfterMinutes:   0,
      minNoticeHours:       0,
      nowUtc:               pastNow,
    });
    const last = slots[slots.length - 1];
    const windowEndUtc = new Date("2026-07-06T20:00:00.000Z");
    expect(last.endsAt.getTime()).toBeLessThanOrEqual(windowEndUtc.getTime());
  });

  it("accounts for buffer_before + buffer_after in slot spacing", () => {
    // block = 5 + 30 + 5 = 40 min. 8h window / 40min = 12 slots
    const slots = generateSlots({
      dateStr:              "2026-07-06",
      timezone:             TZ_SP,
      window,
      durationMinutes:      30,
      bufferBeforeMinutes:  5,
      bufferAfterMinutes:   5,
      minNoticeHours:       0,
      nowUtc:               pastNow,
    });
    expect(slots).toHaveLength(12);
  });

  it("buffer_before offsets the actual slot start inside the block", () => {
    const slots = generateSlots({
      dateStr:              "2026-07-06",
      timezone:             TZ_SP,
      window,
      durationMinutes:      30,
      bufferBeforeMinutes:  10,
      bufferAfterMinutes:   0,
      minNoticeHours:       0,
      nowUtc:               pastNow,
    });
    // First slot starts at 09:10 SP = 12:10 UTC
    expect(slots[0].startsAt.toISOString()).toBe("2026-07-06T12:10:00.000Z");
  });

  it("returns 0 slots when duration > window", () => {
    const slots = generateSlots({
      dateStr:              "2026-07-06",
      timezone:             TZ_SP,
      window:               { startTime: "09:00", endTime: "09:20" },
      durationMinutes:      30,
      bufferBeforeMinutes:  0,
      bufferAfterMinutes:   0,
      minNoticeHours:       0,
      nowUtc:               pastNow,
    });
    expect(slots).toHaveLength(0);
  });

  it("filters out slots that fall within min_notice_hours", () => {
    // nowUtc = 2026-07-06 11:45 UTC (= 08:45 SP, 15 min before window opens)
    // With min_notice_hours = 1, booking must start after 12:45 UTC
    const nowUtc = new Date("2026-07-06T11:45:00Z");
    const slots  = generateSlots({
      dateStr:              "2026-07-06",
      timezone:             TZ_SP,
      window,
      durationMinutes:      30,
      bufferBeforeMinutes:  0,
      bufferAfterMinutes:   0,
      minNoticeHours:       1,
      nowUtc,
    });
    // Min booking start = 12:45 UTC. First available slot at 13:00 UTC (13:00 = 3rd slot).
    expect(slots.length).toBeGreaterThan(0);
    const first = slots[0];
    expect(first.startsAt.getTime()).toBeGreaterThanOrEqual(
      nowUtc.getTime() + 60 * 60 * 1000,
    );
  });

  it("returns 0 slots when nowUtc is after window end", () => {
    // nowUtc is past the entire window
    const nowUtc = new Date("2026-07-06T22:00:00Z"); // 19:00 SP, after 17:00 end
    const slots  = generateSlots({
      dateStr:              "2026-07-06",
      timezone:             TZ_SP,
      window,
      durationMinutes:      30,
      bufferBeforeMinutes:  0,
      bufferAfterMinutes:   0,
      minNoticeHours:       1,
      nowUtc,
    });
    expect(slots).toHaveLength(0);
  });

  it("generates correct slots across month boundary (Jan 31 → Feb 1)", () => {
    const slots = generateSlots({
      dateStr:              "2026-01-31",
      timezone:             TZ_SP,
      window:               { startTime: "23:00", endTime: "23:30" },
      durationMinutes:      30,
      bufferBeforeMinutes:  0,
      bufferAfterMinutes:   0,
      minNoticeHours:       0,
      nowUtc:               pastNow,
    });
    expect(slots).toHaveLength(1);
    // 23:00 SP Jan 31 = 02:00 UTC Feb 1
    expect(slots[0].startsAt.toISOString()).toBe("2026-02-01T02:00:00.000Z");
  });

  it("generates correct slots across year boundary (Dec 31 → Jan 1)", () => {
    const slots = generateSlots({
      dateStr:              "2026-12-31",
      timezone:             TZ_SP,
      window:               { startTime: "23:00", endTime: "23:30" },
      durationMinutes:      30,
      bufferBeforeMinutes:  0,
      bufferAfterMinutes:   0,
      minNoticeHours:       0,
      nowUtc:               pastNow,
    });
    expect(slots).toHaveLength(1);
    expect(slots[0].startsAt.toISOString()).toBe("2027-01-01T02:00:00.000Z");
  });

  it("handles 60-minute duration correctly", () => {
    // 09:00-17:00 = 8h / 60min = 8 slots
    const slots = generateSlots({
      dateStr:              "2026-07-06",
      timezone:             TZ_SP,
      window,
      durationMinutes:      60,
      bufferBeforeMinutes:  0,
      bufferAfterMinutes:   0,
      minNoticeHours:       0,
      nowUtc:               pastNow,
    });
    expect(slots).toHaveLength(8);
  });

  it("each slot duration equals durationMinutes", () => {
    const slots = generateSlots({
      dateStr:              "2026-07-06",
      timezone:             TZ_SP,
      window,
      durationMinutes:      45,
      bufferBeforeMinutes:  0,
      bufferAfterMinutes:   0,
      minNoticeHours:       0,
      nowUtc:               pastNow,
    });
    for (const slot of slots) {
      const durMs = slot.endsAt.getTime() - slot.startsAt.getTime();
      expect(durMs).toBe(45 * 60 * 1000);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. ConflictResolver
// ─────────────────────────────────────────────────────────────────────────────

describe("ConflictResolver › filterConflicts", () => {
  const s = (iso: string) => new Date(iso);

  const candidateA = { startsAt: s("2026-07-06T12:00:00Z"), endsAt: s("2026-07-06T12:30:00Z") };
  const candidateB = { startsAt: s("2026-07-06T12:30:00Z"), endsAt: s("2026-07-06T13:00:00Z") };
  const candidateC = { startsAt: s("2026-07-06T13:00:00Z"), endsAt: s("2026-07-06T13:30:00Z") };

  it("returns all candidates when no bookings exist", () => {
    const result = filterConflicts([candidateA, candidateB], []);
    expect(result).toHaveLength(2);
  });

  it("removes a slot that fully overlaps a booking", () => {
    const booking = { startsAt: s("2026-07-06T12:00:00Z"), endsAt: s("2026-07-06T12:30:00Z") };
    const result  = filterConflicts([candidateA, candidateB, candidateC], [booking]);
    expect(result).toHaveLength(2);
    expect(result).not.toContainEqual(candidateA);
  });

  it("removes a slot where booking starts inside the slot", () => {
    // Booking at 12:15 starts during candidateA (12:00-12:30)
    const booking = { startsAt: s("2026-07-06T12:15:00Z"), endsAt: s("2026-07-06T12:45:00Z") };
    const result  = filterConflicts([candidateA, candidateB], [booking]);
    // candidateA conflicts (booking starts inside it)
    // candidateB conflicts (booking ends inside it)
    expect(result).toHaveLength(0);
  });

  it("removes a slot where booking ends inside the slot", () => {
    // Booking ends at 12:15, candidateA starts at 12:00 — overlap
    const booking = { startsAt: s("2026-07-06T11:45:00Z"), endsAt: s("2026-07-06T12:15:00Z") };
    const result  = filterConflicts([candidateA, candidateB], [booking]);
    expect(result).not.toContainEqual(candidateA);
    expect(result).toContainEqual(candidateB); // candidateB at 12:30 is safe
  });

  it("does NOT remove a slot when booking ends exactly at slot start (half-open interval)", () => {
    // booking 11:30-12:00, slot 12:00-12:30 → no overlap
    const booking = { startsAt: s("2026-07-06T11:30:00Z"), endsAt: s("2026-07-06T12:00:00Z") };
    const result  = filterConflicts([candidateA], [booking]);
    expect(result).toHaveLength(1);
  });

  it("does NOT remove a slot when booking starts exactly at slot end (half-open interval)", () => {
    // slot 12:00-12:30, booking 12:30-13:00 → no overlap
    const booking = { startsAt: s("2026-07-06T12:30:00Z"), endsAt: s("2026-07-06T13:00:00Z") };
    const result  = filterConflicts([candidateA], [booking]);
    expect(result).toHaveLength(1);
  });

  it("removes all conflicting slots when multiple bookings exist", () => {
    const b1 = { startsAt: s("2026-07-06T12:00:00Z"), endsAt: s("2026-07-06T12:30:00Z") };
    const b2 = { startsAt: s("2026-07-06T13:00:00Z"), endsAt: s("2026-07-06T13:30:00Z") };
    const result = filterConflicts([candidateA, candidateB, candidateC], [b1, b2]);
    expect(result).toHaveLength(1);
    expect(result).toContainEqual(candidateB);
  });
});

describe("ConflictResolver › parseBookingWindows", () => {
  it("parses ISO strings into Date objects", () => {
    const rows = [
      { starts_at: "2026-07-06T12:00:00.000Z", ends_at: "2026-07-06T12:30:00.000Z" },
    ];
    const windows = parseBookingWindows(rows);
    expect(windows[0].startsAt).toBeInstanceOf(Date);
    expect(windows[0].endsAt).toBeInstanceOf(Date);
    expect(windows[0].startsAt.toISOString()).toBe("2026-07-06T12:00:00.000Z");
  });

  it("returns empty array for empty input", () => {
    expect(parseBookingWindows([])).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Scheduling Engine (integration: all 4 pure functions composed)
// ─────────────────────────────────────────────────────────────────────────────

describe("getAvailableSlots (engine integration)", () => {
  // 2026-07-06 = Monday
  const DATE   = "2026-07-06";
  const pastNow = new Date("2020-01-01T00:00:00Z");

  const mondayRule = makeRule(1, "09:00:00", "17:00:00");
  const cal        = makeCalendar({ duration_minutes: 30, timezone: TZ_SP });

  it("returns slots for an open Monday with no bookings", () => {
    const slots = getAvailableSlots({
      calendar:            cal,
      dateStr:             DATE,
      rules:               [mondayRule],
      exceptions:          [],
      existingBookingRows: [],
      nowUtc:              pastNow,
    });
    expect(slots.length).toBe(16);
    expect(slots[0].startsAtLocal).toBe("09:00");
    expect(slots[0].startsAt).toBe("2026-07-06T12:00:00.000Z");
    expect(typeof slots[0].dateLabel).toBe("string");
  });

  it("returns empty for a blocked exception even with a valid rule", () => {
    const exc   = makeException(DATE, "blocked");
    const slots = getAvailableSlots({
      calendar:            cal,
      dateStr:             DATE,
      rules:               [mondayRule],
      exceptions:          [exc],
      existingBookingRows: [],
      nowUtc:              pastNow,
    });
    expect(slots).toHaveLength(0);
  });

  it("uses custom_hours exception instead of rule window", () => {
    const exc   = makeException(DATE, "custom_hours", "10:00:00", "12:00:00");
    const slots = getAvailableSlots({
      calendar:            cal,
      dateStr:             DATE,
      rules:               [mondayRule],
      exceptions:          [exc],
      existingBookingRows: [],
      nowUtc:              pastNow,
    });
    // 10:00-12:00 = 2h / 30min = 4 slots
    expect(slots).toHaveLength(4);
    expect(slots[0].startsAtLocal).toBe("10:00");
  });

  it("removes slots already booked (real conflict data)", () => {
    // Book the first slot: 09:00-09:30 SP = 12:00-12:30 UTC
    const existingBookingRows = [
      { starts_at: "2026-07-06T12:00:00.000Z", ends_at: "2026-07-06T12:30:00.000Z" },
    ];
    const slots = getAvailableSlots({
      calendar:            cal,
      dateStr:             DATE,
      rules:               [mondayRule],
      exceptions:          [],
      existingBookingRows,
      nowUtc:              pastNow,
    });
    expect(slots).toHaveLength(15);
    expect(slots[0].startsAtLocal).toBe("09:30");
  });

  it("returns empty when all slots are booked", () => {
    // Fill every 30-min slot from 12:00 to 20:00 UTC
    const existingBookingRows: Array<{ starts_at: string; ends_at: string }> = [];
    let t = new Date("2026-07-06T12:00:00Z");
    while (t < new Date("2026-07-06T20:00:00Z")) {
      const end = new Date(t.getTime() + 30 * 60 * 1000);
      existingBookingRows.push({ starts_at: t.toISOString(), ends_at: end.toISOString() });
      t = end;
    }
    const slots = getAvailableSlots({
      calendar:            cal,
      dateStr:             DATE,
      rules:               [mondayRule],
      exceptions:          [],
      existingBookingRows,
      nowUtc:              pastNow,
    });
    expect(slots).toHaveLength(0);
  });

  it("returns empty for a day with no rule", () => {
    // Only Monday rule, but requesting Sunday
    const slots = getAvailableSlots({
      calendar:            cal,
      dateStr:             "2026-07-05",   // Sunday
      rules:               [mondayRule],
      exceptions:          [],
      existingBookingRows: [],
      nowUtc:              pastNow,
    });
    expect(slots).toHaveLength(0);
  });

  it("respects buffer_before_minutes in slot count", () => {
    const calWithBuffer = makeCalendar({
      duration_minutes:      30,
      buffer_before_minutes: 15,
      buffer_after_minutes:  0,
    });
    // block = 15 + 30 = 45 min; 8h window / 45min = 10 slots (480 / 45 = 10.6 → 10)
    const slots = getAvailableSlots({
      calendar:            calWithBuffer,
      dateStr:             DATE,
      rules:               [mondayRule],
      exceptions:          [],
      existingBookingRows: [],
      nowUtc:              pastNow,
    });
    expect(slots).toHaveLength(10);
  });

  it("endsAt = startsAt + durationMinutes (buffer not included in slot)", () => {
    const slots = getAvailableSlots({
      calendar:            cal,
      dateStr:             DATE,
      rules:               [mondayRule],
      exceptions:          [],
      existingBookingRows: [],
      nowUtc:              pastNow,
    });
    for (const slot of slots) {
      const dur = new Date(slot.endsAt).getTime() - new Date(slot.startsAt).getTime();
      expect(dur).toBe(30 * 60 * 1000);
    }
  });

  it("min_notice_hours filters past slots", () => {
    // nowUtc = 12:00 UTC (= 09:00 SP). With 2h notice, first slot must be after 14:00 UTC (= 11:00 SP)
    const nowUtc = new Date("2026-07-06T12:00:00Z");
    const calWithNotice = makeCalendar({ duration_minutes: 30, min_notice_hours: 2 });
    const slots = getAvailableSlots({
      calendar:            calWithNotice,
      dateStr:             DATE,
      rules:               [mondayRule],
      exceptions:          [],
      existingBookingRows: [],
      nowUtc,
    });
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      expect(new Date(slot.startsAt).getTime()).toBeGreaterThanOrEqual(
        nowUtc.getTime() + 2 * 60 * 60 * 1000,
      );
    }
  });
});
