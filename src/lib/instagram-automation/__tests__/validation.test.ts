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
    expect(input.steps).toEqual([{ type: "message", text: "Olá", delayMinutes: 1, button: null }]);
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
    })).toThrow("escolha os posts específicos");
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

  it("accepts a visual flow, clearing the linear steps and CRM toggle", () => {
    const flow = { version: 1, nodes: [
      { id: "trigger", type: "trigger", position: { x: 0, y: 0 }, data: {} },
      { id: "m", type: "message", position: { x: 300, y: 0 }, data: { text: "Oi", buttons: [] } },
    ], edges: [{ id: "e", source: "trigger", sourceHandle: "next", target: "m" }] };
    const input = sanitizeInstagramAutomationInput({
      connectionId: "connection", name: "Fluxo", status: "active", triggerType: "message", matchType: "any",
      steps: [], crmEnabled: true, crmPipelineId: "p", crmStageId: "s", flow: flow as never,
    });
    expect(input.flow?.nodes).toHaveLength(2);
    expect(input).toMatchObject({ steps: [], crmEnabled: false, crmStageId: null });
  });

  it("saves incomplete flows only as drafts", () => {
    const flow = { version: 1, nodes: [
      { id: "trigger", type: "trigger", position: { x: 0, y: 0 }, data: {} },
      { id: "m", type: "message", position: { x: 300, y: 0 }, data: { text: "", buttons: [] } },
    ], edges: [{ id: "e", source: "trigger", sourceHandle: "next", target: "m" }] };
    const base = { connectionId: "connection", name: "Fluxo", triggerType: "message" as const, matchType: "any" as const, steps: [], crmEnabled: false, flow: flow as never };
    expect(sanitizeInstagramAutomationInput({ ...base, status: "draft" }).flow).toBeTruthy();
    expect(() => sanitizeInstagramAutomationInput({ ...base, status: "active" })).toThrow("Escreva o texto");
  });
});
