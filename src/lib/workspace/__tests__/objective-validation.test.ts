import { describe, it, expect } from "vitest";
import {
  validateObjectiveInput,
  validateTagIds,
} from "../objective-validation";
describe("objective input validation", () => {
  it("rejects empty titles, invalid horizons, and invalid JSON", () => {
    for (const body of [
      null,
      [],
      { title: " " },
      { title: "a", horizon: "unknown" },
    ])
      expect(validateObjectiveInput(body, true)).not.toBeNull();
  });
  it("rejects impossible dates and malformed references", () => {
    expect(validateObjectiveInput({ due_date: "2026-02-30" })).not.toBeNull();
    expect(validateObjectiveInput({ parent_id: "other" })).not.toBeNull();
    expect(validateObjectiveInput({ assignee_ids: "all" })).not.toBeNull();
  });
  it("accepts partial updates and valid optional nulls", () => {
    expect(
      validateObjectiveInput({
        start_date: null,
        parent_id: null,
        assignee_ids: [],
        status: "concluido",
      }),
    ).toBeNull();
    expect(
      validateObjectiveInput(
        { title: "Expandir carteira", due_date: "2026-12-31" },
        true,
      ),
    ).toBeNull();
  });
  it("accepts multiple UUID tags and rejects arbitrary text", () => {
    expect(validateTagIds(["00000000-0000-4000-8000-000000000001"])).toBe(true);
    expect(validateTagIds(["design"])).toBe(false);
  });
});
