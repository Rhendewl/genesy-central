// ── AvailabilityResolver ──────────────────────────────────────────────────────
// Pure function. Given a date, the calendar's weekly rules and date-specific
// exceptions, returns the effective time window for that date (or null if
// the calendar is not available at all on that day).

import type {
  AppointmentAvailabilityRule,
  AppointmentAvailabilityException,
  TimeWindow,
} from "@/types/appointments";
import { getDayOfWeekInTimezone } from "./timezone-resolver";

export interface ResolvedAvailability {
  window: TimeWindow | null;  // null = not available
  source: "rule" | "exception";
}

export function resolveAvailability(
  dateStr:    string,    // "YYYY-MM-DD"
  timezone:   string,    // calendar IANA timezone
  rules:      AppointmentAvailabilityRule[],
  exceptions: AppointmentAvailabilityException[],
): ResolvedAvailability {
  // 1. Check exception first — it always wins over the weekly rule
  const exception = exceptions.find(e => e.exception_date === dateStr);

  if (exception) {
    if (exception.type === "blocked") {
      return { window: null, source: "exception" };
    }

    // custom_hours: exception must have both start_time and end_time
    if (
      exception.type === "custom_hours" &&
      exception.start_time &&
      exception.end_time
    ) {
      return {
        window: {
          startTime: exception.start_time.slice(0, 5),
          endTime:   exception.end_time.slice(0, 5),
        },
        source: "exception",
      };
    }

    // Malformed custom_hours without times — treat as blocked
    return { window: null, source: "exception" };
  }

  // 2. Fall back to weekly rule
  const dayOfWeek = getDayOfWeekInTimezone(dateStr, timezone);
  const rule      = rules.find(r => r.day_of_week === dayOfWeek);

  if (!rule || !rule.is_available) {
    return { window: null, source: "rule" };
  }

  return {
    window: {
      startTime: rule.start_time.slice(0, 5),
      endTime:   rule.end_time.slice(0, 5),
    },
    source: "rule",
  };
}
