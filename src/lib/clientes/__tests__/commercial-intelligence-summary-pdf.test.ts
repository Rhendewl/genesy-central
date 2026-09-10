import { describe, expect, it } from "vitest";
import { calculateCommercialSummaryMetrics, commercialSummaryFilename } from "@/lib/commercial-intelligence-summary-pdf";
import type { CommercialCollection, CommercialResponse } from "@/types/commercial-intelligence";

const collection = {
  period_end: "2026-09-10",
  expected_responses: 4,
  developments: [
    { name: "Áurea", campaignIds: [], campaignNames: [], spend: 1200, leads: 30, impressions: 0, clicks: 0 },
    { name: "Reserva", campaignIds: [], campaignNames: [], spend: 800, leads: 10, impressions: 0, clicks: 0 },
  ],
} as unknown as CommercialCollection;

const responses = [{ score: 8 }, { score: 6 }] as CommercialResponse[];

describe("commercial intelligence summary PDF", () => {
  it("consolida as métricas essenciais do período", () => {
    expect(calculateCommercialSummaryMetrics(collection, responses)).toEqual({
      responses: 2,
      developments: 2,
      averageScore: 7,
      leads: 40,
      spend: 2000,
      cpl: 50,
      responseRate: 50,
    });
  });

  it("gera um nome de arquivo estável e seguro", () => {
    expect(commercialSummaryFilename("Imobiliária Áurea", "2026-09-10"))
      .toBe("resumo-analise-comercial-imobiliaria-aurea-2026-09-10.pdf");
  });
});
