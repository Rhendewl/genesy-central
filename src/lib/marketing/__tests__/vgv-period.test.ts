import { format } from "date-fns";
import { describe, expect, it } from "vitest";
import { getMarketingVgvPeriodRange } from "@/lib/marketing/vgv-period";

function formattedRange(mode: Parameters<typeof getMarketingVgvPeriodRange>[0], reference: Date) {
  const range = getMarketingVgvPeriodRange(mode, reference);
  return {
    start: format(range.start, "yyyy-MM-dd"),
    end: format(range.end, "yyyy-MM-dd"),
  };
}

describe("intervalos do VGV de marketing", () => {
  const reference = new Date(2025, 5, 18);

  it.each([
    ["month", "2025-06-01", "2025-07-01"],
    ["3m", "2025-04-01", "2025-07-01"],
    ["6m", "2025-01-01", "2025-07-01"],
    ["12m", "2024-07-01", "2025-07-01"],
    ["year", "2025-01-01", "2026-01-01"],
  ] as const)("calcula %s usando fim exclusivo", (mode, start, end) => {
    expect(formattedRange(mode, reference)).toEqual({ start, end });
  });

  it("atravessa a virada de ano nos períodos móveis", () => {
    expect(formattedRange("3m", new Date(2025, 0, 15))).toEqual({
      start: "2024-11-01",
      end: "2025-02-01",
    });
  });
});
