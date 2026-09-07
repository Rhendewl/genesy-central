import { describe, expect, it } from "vitest";
import { daysFromToday, monthlyPaymentDate, overdueReminderBucket } from "@/lib/client-lifecycle-alerts";

describe("client lifecycle alert dates", () => {
  it("calculates the next monthly payment date", () => {
    expect(monthlyPaymentDate("2026-09-07", 10)).toBe("2026-09-10");
    expect(monthlyPaymentDate("2026-09-11", 10)).toBe("2026-10-10");
  });

  it("clamps payment days to the last day of short months", () => {
    expect(monthlyPaymentDate("2027-02-20", 31)).toBe("2027-02-28");
  });

  it("calculates future and overdue intervals", () => {
    expect(daysFromToday("2026-09-10", "2026-09-07")).toBe(3);
    expect(daysFromToday("2026-09-01", "2026-09-07")).toBe(-6);
  });

  it("groups overdue reminders into weekly deduplication windows", () => {
    expect(overdueReminderBucket(1)).toBe(0);
    expect(overdueReminderBucket(7)).toBe(0);
    expect(overdueReminderBucket(8)).toBe(1);
  });
});
