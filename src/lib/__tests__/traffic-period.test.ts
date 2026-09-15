import { describe, expect, it } from "vitest";
import { getPreviousTrafficPeriodDates, getTrafficPeriodDates } from "@/lib/traffic-period";

describe("traffic dashboard periods", () => {
  const today = new Date(2026, 8, 15, 12);

  it("uses the selected calendar month instead of repeating today's rolling range", () => {
    expect(getTrafficPeriodDates("month", 2026, 9, today)).toEqual({ since: "2026-09-01", until: "2026-09-15" });
    expect(getTrafficPeriodDates("month", 2026, 8, today)).toEqual({ since: "2026-08-01", until: "2026-08-31" });
    expect(getTrafficPeriodDates("month", 2026, 7, today)).toEqual({ since: "2026-07-01", until: "2026-07-31" });
  });

  it("supports a fourteen-day window anchored to the selected month", () => {
    expect(getTrafficPeriodDates("14d", 2026, 9, today)).toEqual({ since: "2026-09-02", until: "2026-09-15" });
    expect(getTrafficPeriodDates("14d", 2026, 8, today)).toEqual({ since: "2026-08-18", until: "2026-08-31" });
  });

  it("compares a calendar month with the immediately preceding equal-length window", () => {
    expect(getPreviousTrafficPeriodDates("month", 2026, 9, today)).toEqual({ since: "2026-08-17", until: "2026-08-31" });
  });
});
