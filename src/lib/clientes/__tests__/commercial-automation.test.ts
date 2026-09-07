import { describe, expect, it } from "vitest";
import {
  commercialAutomationWindow,
  commercialCollectionDue,
  evaluateCommercialSample,
  inferCommercialAutomationSlot,
  nextCommercialAutomationSlot,
} from "../commercial-automation";

describe("commercial collection automation", () => {
  it("uses a rolling window matching the configured cadence", () => {
    expect(commercialAutomationWindow("2026-09-07", "weekly")).toEqual({ start: "2026-09-01", end: "2026-09-07" });
    expect(commercialAutomationWindow("2026-09-07", "biweekly")).toEqual({ start: "2026-08-25", end: "2026-09-07" });
  });

  it("defers the next collection until its cadence is due", () => {
    expect(commercialCollectionDue("2026-09-01", "2026-09-07", "weekly")).toEqual({ due: false, daysRemaining: 1 });
    expect(commercialCollectionDue("2026-09-01", "2026-09-08", "weekly")).toEqual({ due: true, daysRemaining: 0 });
    expect(commercialCollectionDue(null, "2026-09-08", "weekly").due).toBe(true);
  });

  it("requires both lead volume and active campaign days", () => {
    expect(evaluateCommercialSample({ leads: 2, activeDays: 5, minimumLeads: 5, minimumActiveDays: 3 }).eligible).toBe(false);
    expect(evaluateCommercialSample({ leads: 8, activeDays: 2, minimumLeads: 5, minimumActiveDays: 3 }).eligible).toBe(false);
    expect(evaluateCommercialSample({ leads: 8, activeDays: 3, minimumLeads: 5, minimumActiveDays: 3 }).eligible).toBe(true);
  });

  it("alternates only after a valid collection", () => {
    expect(nextCommercialAutomationSlot(null)).toBe("A");
    expect(nextCommercialAutomationSlot("A")).toBe("B");
    expect(nextCommercialAutomationSlot("B")).toBe("A");
    expect(inferCommercialAutomationSlot("Semana 1 e 3 · Leads", null)).toBe("A");
    expect(inferCommercialAutomationSlot("Semana 2 e 4 · Mercado", null)).toBe("B");
    expect(inferCommercialAutomationSlot("Personalizado", { automation_template_slot: "B" })).toBe("B");
  });
});
