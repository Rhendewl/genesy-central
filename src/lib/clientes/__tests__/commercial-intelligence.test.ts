import { describe, expect, it } from "vitest";
import { buildCommercialDiagnosis, calculateCommercialScore, DEFAULT_CAMPAIGN_PARSER, extractDevelopmentName, filterLeadGenerationDevelopments, isCommercialAnswerValid, resolveCommercialCollectionBrokerIds } from "../commercial-intelligence";

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

describe("commercial answer validation", () => {
  const requiredLongText = { id: "details", type: "long_text", title: "Detalhes", required: true } as const;
  const optionalLongText = { ...requiredLongText, required: false } as const;

  it("requires at least 75 non-whitespace characters in long text answers", () => {
    expect(isCommercialAnswerValid(requiredLongText, "a".repeat(74))).toBe(false);
    expect(isCommercialAnswerValid(requiredLongText, `  ${"a".repeat(75)}  `)).toBe(true);
  });

  it("allows an optional long text to remain empty but validates it when filled", () => {
    expect(isCommercialAnswerValid(optionalLongText, "")).toBe(true);
    expect(isCommercialAnswerValid(optionalLongText, "resposta curta")).toBe(false);
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

describe("lead-generation collection filter", () => {
  it("keeps lead campaigns and removes reach or profile-visit campaigns", () => {
    const developments = [
      { name: "Áurea", campaignIds: ["lead"], campaignNames: [], spend: 0, leads: 0, impressions: 0, clicks: 0 },
      { name: "Vis. Perfil", campaignIds: ["traffic"], campaignNames: [], spend: 100, leads: 0, impressions: 10000, clicks: 200 },
      { name: "Atlas", campaignIds: ["reach-with-lead"], campaignNames: [], spend: 200, leads: 3, impressions: 15000, clicks: 100 },
    ];
    const filtered = filterLeadGenerationDevelopments(developments, new Map([["lead", "leads"], ["traffic", "trafego"], ["reach-with-lead", "alcance"]]));
    expect(filtered.map((item) => item.name)).toEqual(["Áurea", "Atlas"]);
  });
});

describe("commercial collection participation", () => {
  const brokers = [
    { id: "broker-original", created_at: "2026-09-01T10:00:00Z" },
    { id: "broker-later", created_at: "2026-09-08T10:00:00Z" },
  ];

  it("does not create retroactive pending answers for brokers registered later", () => {
    expect(resolveCommercialCollectionBrokerIds({
      created_at: "2026-09-04T10:00:00Z",
      meta_snapshot: {},
    }, brokers)).toEqual(["broker-original"]);
  });

  it("uses the immutable participant snapshot when the collection provides it", () => {
    expect(resolveCommercialCollectionBrokerIds({
      created_at: "2026-09-10T10:00:00Z",
      meta_snapshot: { broker_ids: ["broker-original"] },
    }, brokers)).toEqual(["broker-original"]);
  });

  it("recognizes recipients recorded by automated legacy collections", () => {
    expect(resolveCommercialCollectionBrokerIds({
      created_at: "2026-09-10T10:00:00Z",
      meta_snapshot: { email_recipients: [{ broker_id: "broker-later", email: "broker@example.com" }] },
    }, brokers)).toEqual(["broker-later"]);
  });
});
