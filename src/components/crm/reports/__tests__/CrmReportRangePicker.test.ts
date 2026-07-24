import { describe, expect, it } from "vitest";
import { normalizeSelectedRange } from "../crm-report-range";

describe("normalizeSelectedRange", () => {
  it("mantem a ordem quando o fim e posterior ao inicio", () => {
    const range = normalizeSelectedRange(
      new Date(2026, 6, 1, 15, 30),
      new Date(2026, 6, 17, 9, 20),
    );

    expect(range.from).toEqual(new Date(2026, 6, 1, 0, 0, 0, 0));
    expect(range.to).toEqual(new Date(2026, 6, 17, 23, 59, 59, 999));
  });

  it("inverte automaticamente quando a segunda data e anterior", () => {
    const range = normalizeSelectedRange(
      new Date(2026, 6, 17),
      new Date(2026, 6, 1),
    );

    expect(range.from).toEqual(new Date(2026, 6, 1, 0, 0, 0, 0));
    expect(range.to).toEqual(new Date(2026, 6, 17, 23, 59, 59, 999));
  });
});
