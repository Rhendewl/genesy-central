import { endOfDay, startOfDay } from "date-fns";

export function normalizeSelectedRange(first: Date, second: Date) {
  return first <= second
    ? { from: startOfDay(first), to: endOfDay(second) }
    : { from: startOfDay(second), to: endOfDay(first) };
}
