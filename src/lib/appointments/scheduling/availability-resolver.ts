// ── AvailabilityResolver ──────────────────────────────────────────────────────
// Pure function. Given a date, the calendar's weekly rules and date-specific
// exceptions, returns the effective time windows for that date.
//
// Sprint 1: supports multiple intervals per day (e.g. 09-12 + 14-18).
// Exceptions override all rules and always produce a single window (or none).

import type {
  AppointmentAvailabilityRule,
  AppointmentAvailabilityException,
  TimeWindow,
} from "@/types/appointments";
import { getDayOfWeekInTimezone } from "./timezone-resolver";

export interface ResolvedAvailability {
  windows: TimeWindow[];  // empty = not available on this date
  source:  "rule" | "exception";
}

export function resolveAvailability(
  dateStr:    string,    // "YYYY-MM-DD"
  timezone:   string,    // calendar IANA timezone
  rules:      AppointmentAvailabilityRule[],
  exceptions: AppointmentAvailabilityException[],
): ResolvedAvailability {
  // 1. Check exception first — it always wins over the weekly rules
  const exception = exceptions.find(e => e.exception_date === dateStr);

  if (exception) {
    if (exception.type === "blocked") {
      return { windows: [], source: "exception" };
    }

    if (
      exception.type === "custom_hours" &&
      exception.start_time &&
      exception.end_time
    ) {
      return {
        windows: [{
          startTime: exception.start_time.slice(0, 5),
          endTime:   exception.end_time.slice(0, 5),
        }],
        source: "exception",
      };
    }

    // Malformed custom_hours (missing times) → treated as blocked
    return { windows: [], source: "exception" };
  }

  // 2. Fall back to weekly rules — collect ALL intervals for this day
  const dayOfWeek = getDayOfWeekInTimezone(dateStr, timezone);
  const dayRules  = rules.filter(r => r.day_of_week === dayOfWeek && r.is_available);

  if (dayRules.length === 0) {
    return { windows: [], source: "rule" };
  }

  // Sort by start_time so callers always receive an ordered list
  const sorted = [...dayRules].sort((a, b) =>
    a.start_time.localeCompare(b.start_time),
  );

  return {
    windows: sorted.map(r => ({
      startTime: r.start_time.slice(0, 5),
      endTime:   r.end_time.slice(0, 5),
    })),
    source: "rule",
  };
}
