import { describe, expect, it } from "vitest";
import { buildCommercialDiagnosis, calculateCommercialScore, DEFAULT_CAMPAIGN_PARSER, extractDevelopmentName } from "../commercial-intelligence";

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

describe("commercial high-performance diagnosis", () => {
  it("anchors recommendations in media and broker evidence", () => {
    const diagnosis = buildCommercialDiagnosis([
      { name: "Áurea", campaignIds: ["campaign-1"], campaignNames: ["[Áurea] - [FORM EXT]"], spend: 1200, leads: 40, impressions: 20000, clicks: 500 },
      { name: "Atlas", campaignIds: ["campaign-2"], campaignNames: ["[Atlas] - [FORM EXT]"], spend: 900, leads: 15, impressions: 12000, clicks: 210 },
    ], [
      { id: "response-1", collection_id: "collection", broker_id: "broker-1", development_name: "Áurea", answers: {}, score: 9, objection: "Entrada alta", completed_at: "2026-09-04T12:00:00Z" },
      { id: "response-2", collection_id: "collection", broker_id: "broker-2", development_name: "Atlas", answers: {}, score: 5, objection: "Entrada alta", completed_at: "2026-09-04T12:10:00Z" },
    ]);

    expect(diagnosis.executiveSummary).toContain("55 leads");
    expect(diagnosis.highlights.join(" ")).toContain("Áurea");
    expect(diagnosis.risks.join(" ")).toContain("Entrada alta");
    expect(diagnosis.recommendations.join(" ")).toContain("Prioridade 1");
    expect(diagnosis.recommendations.join(" ")).toContain("CPL");
  });
});
