import { endOfMonth, format, startOfMonth, subDays } from "date-fns";

export type TrafficPeriodKey = "month" | "7d" | "14d" | "30d" | "90d";

const PERIOD_DAYS: Record<Exclude<TrafficPeriodKey, "month">, number> = {
  "7d": 7,
  "14d": 14,
  "30d": 30,
  "90d": 90,
};

function selectedMonthEnd(year: number, month: number, today: Date): Date {
  const chosen = new Date(year, month - 1, 1);
  const current = new Date(today.getFullYear(), today.getMonth(), 1);
  return chosen.getTime() === current.getTime() ? today : endOfMonth(chosen);
}

/**
 * Calendar month is the default view. Rolling windows are anchored to the
 * selected month, so changing the month can never keep querying today's range.
 */
export function getTrafficPeriodDates(
  period: TrafficPeriodKey,
  year: number,
  month: number,
  today = new Date(),
): { since: string; until: string } {
  const end = selectedMonthEnd(year, month, today);
  const start = period === "month"
    ? startOfMonth(new Date(year, month - 1, 1))
    : subDays(end, PERIOD_DAYS[period] - 1);

  return { since: format(start, "yyyy-MM-dd"), until: format(end, "yyyy-MM-dd") };
}

export function getPreviousTrafficPeriodDates(
  period: TrafficPeriodKey,
  year: number,
  month: number,
  today = new Date(),
): { since: string; until: string } {
  const current = getTrafficPeriodDates(period, year, month, today);
  const currentStart = new Date(`${current.since}T12:00:00`);
  const currentEnd = new Date(`${current.until}T12:00:00`);
  const days = Math.round((currentEnd.getTime() - currentStart.getTime()) / 86_400_000) + 1;
  const end = subDays(currentStart, 1);
  const start = subDays(end, days - 1);
  return { since: format(start, "yyyy-MM-dd"), until: format(end, "yyyy-MM-dd") };
}
