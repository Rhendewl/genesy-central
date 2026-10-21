import { describe, it, expect } from "vitest";
import { newBscDraft, validateBscDraft } from "../bsc-draft";
import { bscMetricProgress } from "../bsc";
function valid() {
  const d = newBscDraft();
  d.title = "Crescer";
  d.areas.forEach((a) => {
    a.indicator = "Resultado";
    a.unit = "R$";
    a.target = "20000";
    a.baseline = "8000";
    a.current_value = "15000";
  });
  return d;
}
describe("Guided BSC", () => {
  it("matches cumulative progress in the reference design", () => {
    expect(bscMetricProgress(8000, 20000, 15000)).toBe(75);
    expect(bscMetricProgress(10, 0, 5)).toBe(50);
    expect(bscMetricProgress(0, 100, 200)).toBe(100);
    expect(bscMetricProgress(0, 100, -20)).toBe(0);
    expect(bscMetricProgress(0, 100, NaN)).toBe(0);
  });
  it("requires four distinct perspectives and all metrics", () => {
    expect(validateBscDraft(valid())).toBeNull();
    const d = valid();
    d.areas[3].perspective = "financeira";
    expect(validateBscDraft(d)).not.toBeNull();
    expect(validateBscDraft(newBscDraft())).not.toBeNull();
  });
  it("rejects empty values, identical baseline and target, invalid dates and foreign IDs", () => {
    for (const mutation of [
      (d: ReturnType<typeof valid>) => {
        d.areas[0].target = "";
      },
      (d: ReturnType<typeof valid>) => {
        d.areas[0].target = "8000";
      },
      (d: ReturnType<typeof valid>) => {
        d.start_date = "2026-12-01";
        d.due_date = "2026-10-01";
      },
      (d: ReturnType<typeof valid>) => {
        d.areas[0].task_ids = ["bad"];
      },
      (d: ReturnType<typeof valid>) => {
        d.areas[0].current_value = "Infinity";
      },
    ]) {
      const d = valid();
      mutation(d);
      expect(validateBscDraft(d)).not.toBeNull();
    }
  });
  it("allows no tasks, or linking existing tasks, without inventing required work", () => {
    const d = valid();
    d.areas[0].task_ids = ["00000000-0000-4000-8000-000000000001"];
    expect(validateBscDraft(d)).toBeNull();
  });
});
