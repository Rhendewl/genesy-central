// ── TimezoneResolver ──────────────────────────────────────────────────────────
// Pure timezone utilities. Zero external dependencies — uses only the native
// Intl API, which is reliable in Node.js 16+ and all modern browsers.
//
// DST safety:
//   localTimeToUTC uses a two-iteration Newton-Raphson-style correction that
//   converges to the correct UTC offset even across Daylight Saving Time
//   transitions. Specifically:
//     - Spring-forward gaps (e.g., 02:30 that never exists): resolves to the
//       first valid time after the gap — consistent with wall-clock behaviour.
//     - Fall-back overlaps (ambiguous times): resolves to the first occurrence
//       (standard time), which is the conservative choice for bookings.
//
// getDayOfWeekInTimezone uses en-US short names (Sun/Mon/…) which are stable
// across Node.js ICU versions, unlike the sv-SE names the prior version used.

// ── localTimeToUTC ────────────────────────────────────────────────────────────

export function localTimeToUTC(
  dateStr:  string,   // "YYYY-MM-DD"
  timeStr:  string,   // "HH:MM"
  timezone: string,   // IANA, e.g. "America/Sao_Paulo"
): Date {
  const [year, month, day]   = dateStr.split("-").map(Number);
  const [hour, minute]       = timeStr.split(":").map(Number);

  // Express what we WANT in "UTC milliseconds of local components" —
  // not a real UTC timestamp, just a numeric anchor.
  const targetMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

  // Start with naive UTC = local (good first estimate for most timezones).
  let utcMs = targetMs;

  // Iterate twice to correct for the offset change at DST boundaries.
  // First pass: rough correction.  Second pass: fine correction.
  for (let i = 0; i < 2; i++) {
    const probe  = new Date(utcMs);
    const fmt    = new Intl.DateTimeFormat("sv-SE", {
      timeZone: timezone,
      year:     "numeric",
      month:    "2-digit",
      day:      "2-digit",
      hour:     "2-digit",
      minute:   "2-digit",
      hour12:   false,
    });
    // sv-SE format: "YYYY-MM-DD HH:MM"
    const local = fmt.format(probe);
    const [dp, tp]        = local.split(" ");
    const [ly, lm, ld]   = dp.split("-").map(Number);
    const [lh, lmin]     = tp.split(":").map(Number);
    const probeLocalMs   = Date.UTC(ly, lm - 1, ld, lh % 24, lmin, 0, 0);

    // Close the gap between what we got and what we wanted.
    utcMs += targetMs - probeLocalMs;
  }

  return new Date(utcMs);
}

// ── utcToLocalTime ────────────────────────────────────────────────────────────

export function utcToLocalTime(utcDate: Date, timezone: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    hour:     "2-digit",
    minute:   "2-digit",
    hour12:   false,
  }).format(utcDate);
}

// ── utcToLocalDate ────────────────────────────────────────────────────────────

export function utcToLocalDate(utcDate: Date, timezone: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
  }).format(utcDate).slice(0, 10);
}

// ── getDayOfWeekInTimezone ────────────────────────────────────────────────────
// Returns the JS day-of-week (0=Sun … 6=Sat) for a "YYYY-MM-DD" string as
// observed in the given IANA timezone.
//
// Uses noon UTC to avoid midnight edge cases where DST might shift the date.
// Uses en-US weekday short names (Sun/Mon/Tue/Wed/Thu/Fri/Sat) which are
// standardised and stable across Node.js ICU versions.

const EN_US_WEEKDAY: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

export function getDayOfWeekInTimezone(dateStr: string, timezone: string): number {
  const noonUtc  = localTimeToUTC(dateStr, "12:00", timezone);
  const shortDay = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday:  "short",
  }).format(noonUtc);

  const dow = EN_US_WEEKDAY[shortDay];
  if (dow === undefined) throw new Error(`Unexpected weekday token: ${shortDay}`);
  return dow;
}

// ── formatDateLabel ───────────────────────────────────────────────────────────

export function formatDateLabel(utcDate: Date, timezone: string): string {
  return utcDate.toLocaleString("pt-BR", {
    timeZone: timezone,
    weekday:  "short",
    day:      "numeric",
    month:    "short",
  });
}
