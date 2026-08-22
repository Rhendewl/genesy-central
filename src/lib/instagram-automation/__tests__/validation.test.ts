import { describe, expect, it } from "vitest";
import { assertInstagramConnectionReady, sanitizeInstagramAutomationInput } from "../validation";

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

  it("preserves configurable CRM defaults", () => {
    const input = sanitizeInstagramAutomationInput({
      connectionId: "connection", name: "CRM", triggerType: "message", matchType: "any",
      steps: [{ type: "message", text: "Olá", delayMinutes: 0 }], crmEnabled: true,
      crmPipelineId: "pipeline", crmStageId: "stage", crmOriginId: "origin",
      crmAssignedTo: "profile", crmDealValue: 250000,
    });
    expect(input).toMatchObject({
      crmOriginId: "origin", crmAssignedTo: "profile", crmDealValue: 250000,
    });
  });

  it("blocks broad active comment automations", () => {
    expect(() => sanitizeInstagramAutomationInput({
      connectionId: "connection", name: "Todos", status: "active", triggerType: "comment", matchType: "any",
      steps: [{ type: "message", text: "Olá", delayMinutes: 0 }], crmEnabled: false,
    })).toThrow("exigem uma palavra");
  });

  it("requires spacing between consecutive direct messages", () => {
    expect(() => sanitizeInstagramAutomationInput({
      connectionId: "connection", name: "Sequência", status: "active", triggerType: "message", matchType: "any",
      steps: [
        { type: "message", text: "Olá", delayMinutes: 0 },
        { type: "message", text: "Mais informações", delayMinutes: 0 },
      ], crmEnabled: false,
    })).toThrow("ao menos 1 minuto");
  });

  it("requires subscribed fields and scopes before activation", () => {
    const input = sanitizeInstagramAutomationInput({
      connectionId: "connection", name: "Direct", status: "active", triggerType: "message", matchType: "any",
      steps: [{ type: "message", text: "Olá", delayMinutes: 0 }], crmEnabled: false,
    });
    expect(() => assertInstagramConnectionReady(input, {
      status: "connected", webhook_subscribed: true, webhook_fields: ["messages"],
      requested_scopes: ["instagram_business_basic"],
    })).toThrow("reautorizada");
    expect(() => assertInstagramConnectionReady(input, {
      status: "connected", webhook_subscribed: true, webhook_fields: ["messages"],
      requested_scopes: ["instagram_business_basic", "instagram_business_manage_messages"],
    })).not.toThrow();
  });
});
