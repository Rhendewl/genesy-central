import { describe, expect, it } from "vitest";
import { formatCommercialAnalysisTitle } from "@/lib/clientes/commercial-analysis-format";

describe("formatCommercialAnalysisTitle", () => {
  it("formats the first week of a month", () => {
    expect(formatCommercialAnalysisTitle("2026-08-07")).toBe("Agosto | Semana 01");
  });

  it("pads subsequent week numbers", () => {
    expect(formatCommercialAnalysisTitle("2026-08-20")).toBe("Agosto | Semana 03");
  });
});
