import { describe, expect, it } from "vitest";
import { buildInsights } from "../insights";
import type { AutomationFlow } from "../flow";

const flow: AutomationFlow = {
  version: 1,
  nodes: [
    { id: "trigger", type: "trigger", position: { x: 0, y: 0 }, data: {} },
    { id: "m1", type: "message", position: { x: 0, y: 0 }, data: { text: "Você é corretor?", buttons: [{ id: "yes", kind: "reply", label: "Sim" }, { id: "no", kind: "reply", label: "Não" }], timeoutMinutes: null } },
    { id: "d", type: "delay", position: { x: 0, y: 0 }, data: { seconds: 5, typing: true } },
    { id: "m2", type: "message", position: { x: 0, y: 0 }, data: { text: "Legal!", buttons: [], timeoutMinutes: null } },
    { id: "crm", type: "action", position: { x: 0, y: 0 }, data: { kind: "crm", crm: { pipelineId: "p", stageId: "s", originId: null, assignedTo: null, dealValue: 0 } } },
  ],
  edges: [
    { id: "e1", source: "trigger", sourceHandle: "next", target: "m1" },
    { id: "e2", source: "m1", sourceHandle: "button:yes", target: "d" },
    { id: "e3", source: "d", sourceHandle: "next", target: "m2" },
    { id: "e4", source: "m2", sourceHandle: "next", target: "crm" },
  ],
};

const now = new Date("2026-11-26T15:00:00Z");
const RUN_A = "11111111-1111-4111-8111-111111111111";
const RUN_B = "22222222-2222-4222-8222-222222222222";
const RUN_C = "33333333-3333-4333-8333-333333333333";

describe("automation insights", () => {
  it("summarises entries, completion, funnel, taps, collected data and interruptions", () => {
    const insights = buildInsights({
      flow, days: 7, now,
      previous: { entered: 1, completed: 1 },
      runs: [
        { id: RUN_A, status: "completed", created_at: "2026-11-26T12:00:00Z", completed_at: "2026-11-26T12:01:00Z", contact_id: "c1", crm_lead_id: "lead", variables: { interactions: 1 } },
        { id: RUN_B, status: "waiting", created_at: "2026-11-25T13:00:00Z", completed_at: null, contact_id: "c2", crm_lead_id: null, variables: {} },
        { id: RUN_C, status: "completed", created_at: "2026-11-24T13:00:00Z", completed_at: "2026-11-24T13:03:00Z", contact_id: "c2", crm_lead_id: null, variables: {} },
      ],
      jobs: [
        { run_id: RUN_A, action_type: "flow_node", status: "completed", payload: { nodeId: "trigger", sent: true }, last_error: null },
        { run_id: RUN_A, action_type: "flow_node", status: "completed", payload: { nodeId: "m1", sent: true }, last_error: null },
        { run_id: RUN_A, action_type: "flow_node", status: "completed", payload: { nodeId: "m2", sent: true }, last_error: null },
        { run_id: RUN_A, action_type: "flow_node", status: "completed", payload: { nodeId: "crm", counted: true }, last_error: null },
        { run_id: RUN_A, action_type: "flow_timeout", status: "skipped", payload: { nodeId: "m1" }, last_error: "Contato interagiu antes do tempo limite" },
        { run_id: RUN_B, action_type: "flow_node", status: "completed", payload: { nodeId: "m1", sent: true }, last_error: null },
        { run_id: RUN_C, action_type: "flow_node", status: "skipped", payload: { nodeId: "m1" }, last_error: "Janela de mensagens permitida pela Meta encerrada" },
        { run_id: "other-run", action_type: "flow_node", status: "completed", payload: { nodeId: "m1", sent: true }, last_error: null },
      ],
      taps: [{ runId: RUN_A, nodeId: "m1", buttonId: "yes" }, { runId: "elsewhere", nodeId: "m1", buttonId: "no" }],
      contacts: [
        { id: "c1", username: "duda", full_name: "Maria Eduarda", fields: { whatsapp: "5585999990000" } },
        { id: "c2", username: "joao", full_name: null, fields: {} },
      ],
    });
    expect(insights.totals).toMatchObject({
      entered: 3, completed: 2, inProgress: 1, failed: 0, interacted: 1, messagesSent: 4, leads: 1, withData: 1,
    });
    expect(insights.totals.completionRate).toBeCloseTo(2 / 3);
    expect(insights.totals.avgCompletionSeconds).toBe(120);
    expect(insights.daily).toHaveLength(7);
    expect(insights.daily.slice(-3).map(day => day.entered)).toEqual([1, 1, 1]);
    expect(insights.hours[9]).toBe(1); // 12:00 UTC = 09:00 in Fortaleza
    expect(insights.funnel.map(step => [step.nodeId, step.reached])).toEqual([["trigger", 3], ["m1", 2], ["m2", 1], ["crm", 1]]);
    expect(insights.buttons.map(button => [button.label, button.taps])).toEqual([["Sim", 1], ["Não", 0]]);
    expect(insights.fields).toEqual([{ key: "whatsapp", label: "WhatsApp", count: 1 }]);
    expect(insights.interruptions).toEqual([{ reason: "Janela de mensagens permitida pela Meta encerrada", count: 1 }]);
    expect(insights.recent[0]).toMatchObject({ runId: RUN_A, name: "Maria Eduarda", whatsapp: "5585999990000", lead: true });
    expect(insights.recent[1]).toMatchObject({ name: "@joao", status: "waiting" });
  });

  it("handles a flow with no activity", () => {
    const insights = buildInsights({ flow, days: 30, now, previous: { entered: 0, completed: 0 }, runs: [], jobs: [], taps: [], contacts: [] });
    expect(insights.totals.entered).toBe(0);
    expect(insights.totals.completionRate).toBe(0);
    expect(insights.totals.avgCompletionSeconds).toBeNull();
    expect(insights.daily).toHaveLength(30);
    expect(insights.funnel[0]).toMatchObject({ title: "Entraram", reached: 0 });
  });
});
