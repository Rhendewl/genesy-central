import { describe, expect, it } from "vitest";
import { matchesInstagramKeywords, normalizeInstagramText, validateInstagramSequence } from "../matching";

describe("Instagram automation matching", () => {
  it("matches case and accents without changing phrase boundaries", () => {
    expect(normalizeInstagramText("  QUÉRO   Saber Mais ")).toBe("quero saber mais");
    expect(matchesInstagramKeywords("QUERO saber mais!", ["quero saber"], "contains")).toBe(true);
  });

  it("supports exact, prefix and any match modes", () => {
    expect(matchesInstagramKeywords("material por favor", ["material"], "starts_with")).toBe(true);
    expect(matchesInstagramKeywords("material por favor", ["material"], "exact")).toBe(false);
    expect(matchesInstagramKeywords("", [], "any")).toBe(true);
  });

  it("enforces Meta windows for comment and direct sequences", () => {
    expect(validateInstagramSequence({ triggerType: "comment", steps: [
      { text: "Primeira", delayMinutes: 0 }, { text: "Segunda", delayMinutes: 1 },
    ] })).toContain("única resposta privada");
    expect(validateInstagramSequence({ triggerType: "message", steps: [
      { text: "Primeira", delayMinutes: 700 }, { text: "Segunda", delayMinutes: 700 },
    ] })).toContain("24 horas");
  });
});
