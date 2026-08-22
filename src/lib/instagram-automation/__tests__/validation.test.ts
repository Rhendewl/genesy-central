import { describe, expect, it } from "vitest";
import { sanitizeInstagramAutomationInput } from "../validation";

describe("Instagram automation input", () => {
  it("sanitizes keywords and sequence values", () => {
    const input = sanitizeInstagramAutomationInput({
      connectionId: "connection", name: " Campanha ", status: "active", triggerType: "message",
      matchType: "contains", keywords: [" Quero ", "Quero", ""],
      steps: [{ type: "message", text: " Olá ", delayMinutes: 1.4 }], crmEnabled: false,
    });
    expect(input.name).toBe("Campanha");
    expect(input.keywords).toEqual(["Quero"]);
    expect(input.steps).toEqual([{ type: "message", text: "Olá", delayMinutes: 1 }]);
  });

  it("requires a CRM destination when CRM sync is enabled", () => {
    expect(() => sanitizeInstagramAutomationInput({
      connectionId: "connection", name: "CRM", triggerType: "message", matchType: "any",
      steps: [{ type: "message", text: "Olá", delayMinutes: 0 }], crmEnabled: true,
    })).toThrow("Selecione a pipeline");
  });
});
