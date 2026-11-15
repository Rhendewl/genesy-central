import { describe, expect, it } from "vitest";
import { matchesLeadSearch } from "../lead-search";
const lead = { name: "João da Silva", contact: "+55 (85) 99999-1234" };
describe("CRM lead search", () => {
  it("matches names regardless of accents, case or extra whitespace", () => {
    expect(matchesLeadSearch(lead, " JOAO  DA ")).toBe(true);
    expect(matchesLeadSearch(lead, "silva")).toBe(true);
    expect(matchesLeadSearch(lead, "Maria")).toBe(false);
  });
  it("matches phone fragments regardless of formatting", () => {
    expect(matchesLeadSearch(lead, "85999991234")).toBe(true);
    expect(matchesLeadSearch(lead, "(85) 99999-1234")).toBe(true);
    expect(matchesLeadSearch(lead, "1234")).toBe(true);
    expect(matchesLeadSearch(lead, "Joao 1234")).toBe(false);
  });
  it("keeps all leads for an empty query without treating numeric emails as phone numbers", () => {
    expect(matchesLeadSearch(lead, " ")).toBe(true);
    expect(matchesLeadSearch({ name: "Ana", contact: "ana1234@example.com" }, "1234")).toBe(false);
  });
});
