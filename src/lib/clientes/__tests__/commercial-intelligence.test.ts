import { describe, expect, it } from "vitest";
import { calculateCommercialScore, DEFAULT_CAMPAIGN_PARSER, extractDevelopmentName } from "../commercial-intelligence";

describe("commercial intelligence campaign parser", () => {
  it("extracts the first meaningful bracket", () => {
    expect(extractDevelopmentName("[ATLAS] - LEAD FORM", DEFAULT_CAMPAIGN_PARSER)).toBe("Atlas");
  });

  it("ignores date and operational brackets", () => {
    expect(extractDevelopmentName("[20/05/2026] - [LEAD FORM] - BLANC NEO")).toBe("Blanc Neo");
  });

  it("supports a custom parser", () => {
    expect(extractDevelopmentName("MIRAH | LEADS | 2026", "^([^|]+)")).toBe("Mirah");
  });

  it("does not throw with an invalid expression", () => {
    expect(extractDevelopmentName("ATLAS - LEADS", "[")).toBe("Atlas");
  });
});

describe("commercial scoring", () => {
  it("combines weighted rating and scored choice fields", () => {
    const score = calculateCommercialScore([
      { id: "quality", type: "rating", title: "Qualidade", required: true, maxRating: 10, weight: "critical" },
      { id: "interest", type: "single_choice", title: "Interesse", required: true, weight: "low", choices: [{ id: "1", label: "Alto", value: "high", score: 5 }] },
    ], { quality: 8, interest: "high" });
    expect(score).toBe(8.33);
  });
});
