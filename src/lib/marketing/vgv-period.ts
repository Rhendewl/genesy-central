import { addMonths, startOfMonth } from "date-fns";

export type MarketingVgvPeriodMode = "month" | "3m" | "6m" | "12m" | "year";

export function getMarketingVgvPeriodRange(mode: MarketingVgvPeriodMode, reference: Date) {
  const anchor = startOfMonth(reference);
  if (mode === "year") {
    const start = new Date(anchor.getFullYear(), 0, 1);
    return { start, end: new Date(anchor.getFullYear() + 1, 0, 1) };
  }

  const months = mode === "month" ? 1 : Number.parseInt(mode, 10);
  return { start: addMonths(anchor, -(months - 1)), end: addMonths(anchor, 1) };
}
