import { describe, expect, it } from "vitest";
import {
  buildFlowPayload,
  connectNodes,
  contactWindow,
  emptyFlow,
  evaluateCondition,
  flowErrors,
  instagramMessageBody,
  legacyStepsToFlow,
  messageDelivery,
  nextNodeId,
  nodeOutputs,
  parseFlowPayload,
  pruneDanglingEdges,
  removeFlowNode,
  sanitizeFlow,
  validateFlow,
  type AutomationFlow,
  type FlowButton,
  type FlowNode,
} from "../flow";

const RUN = "8f14e45f-ceea-467a-9575-6f8b2d1c7a10";

function message(id: string, text: string, buttons: FlowButton[] = [], timeoutMinutes: number | null = null): FlowNode {
  return { id, type: "message", position: { x: 0, y: 0 }, data: { text, buttons, timeoutMinutes } };
}

function flow(nodes: FlowNode[], edges: Array<[string, string, string]>): AutomationFlow {
  return {
    version: 1,
    nodes: [{ id: "trigger", type: "trigger", position: { x: 0, y: 0 }, data: {} }, ...nodes],
    edges: edges.map(([source, sourceHandle, target], index) => ({ id: `e${index}`, source, sourceHandle, target })),
  };
}

describe("legacy automations as flows", () => {
  it("turns a DM sequence into delay + message blocks and appends the CRM action", () => {
    const converted = legacyStepsToFlow({
      triggerType: "message",
      steps: [{ text: "Olá", delayMinutes: 0 }, { text: "Ainda por aí?", delayMinutes: 30, button: { label: "Ver", url: "https://a.com" } }],
      crmEnabled: true, crmPipelineId: "p", crmStageId: "s", crmDealValue: 10,
    });
    expect(converted.nodes.map(node => node.type)).toEqual(["trigger", "message", "delay", "message", "action"]);
    expect(nextNodeId(converted, "trigger", "next")).toBe("legacy_msg_0");
    expect(nextNodeId(converted, "legacy_msg_0", "next")).toBe("legacy_delay_1");
    expect(converted.nodes[2]).toMatchObject({ data: { minutes: 30 } });
    expect(converted.nodes[3]).toMatchObject({ data: { buttons: [{ kind: "url", url: "https://a.com", label: "Ver" }] } });
    expect(converted.nodes[4]).toMatchObject({ data: { kind: "crm", crm: { pipelineId: "p", stageId: "s", dealValue: 10 } } });
    expect(flowErrors(validateFlow(converted, "message"))).toEqual([]);
  });

  it("keeps a single private reply for comments", () => {
    const converted = legacyStepsToFlow({ triggerType: "comment", steps: [{ text: "Um" }, { text: "Dois", delayMinutes: 5 }] });
    expect(converted.nodes.filter(node => node.type === "message")).toHaveLength(1);
    expect(flowErrors(validateFlow(converted, "comment"))).toEqual([]);
  });
});

describe("flow validation", () => {
  it("blocks a second message after a comment's private reply without interaction", () => {
    const graph = flow([message("a", "Oi"), { id: "d", type: "delay", position: { x: 0, y: 0 }, data: { minutes: 10 } }, message("b", "De novo")],
      [["trigger", "next", "a"], ["a", "next", "d"], ["d", "next", "b"]]);
    const errors = flowErrors(validateFlow(graph, "comment"));
    expect(errors).toHaveLength(1);
    expect(errors[0].nodeId).toBe("b");
  });

  it("allows the conversation to continue after a reply button on a comment flow", () => {
    const graph = flow([
      message("a", "Quer a tabela?", [{ id: "yes", label: "Quero", kind: "reply" }]),
      message("b", "Aqui está"),
      { id: "w", type: "wait_reply", position: { x: 0, y: 0 }, data: { timeoutMinutes: 120 } },
      { id: "d", type: "delay", position: { x: 0, y: 0 }, data: { minutes: 1200 } },
      message("c", "Ficou alguma dúvida?"),
    ], [["trigger", "next", "a"], ["a", "button:yes", "b"], ["b", "next", "w"], ["w", "timeout", "d"], ["d", "next", "c"]]);
    const issues = validateFlow(graph, "comment");
    expect(flowErrors(issues)).toEqual([]);
    // 120 min waiting + 1200 min delay = 22h, still inside the standard window
    expect(issues.filter(issue => issue.nodeId === "c")).toEqual([]);
  });

  it("warns when a follow-up only fits the 7-day ad window and errors beyond it", () => {
    const late = flow([message("a", "Oi"), { id: "d", type: "delay", position: { x: 0, y: 0 }, data: { minutes: 2 * 1440 } }, message("b", "Volta")],
      [["trigger", "next", "a"], ["a", "next", "d"], ["d", "next", "b"]]);
    expect(validateFlow(late, "message")).toEqual([expect.objectContaining({ nodeId: "b", level: "warning" })]);
    const tooLate = flow([message("a", "Oi"), { id: "d", type: "delay", position: { x: 0, y: 0 }, data: { minutes: 7 * 1440 } },
      { id: "d2", type: "delay", position: { x: 0, y: 0 }, data: { minutes: 60 } }, message("b", "Volta")],
    [["trigger", "next", "a"], ["a", "next", "d"], ["d", "next", "d2"], ["d2", "next", "b"]]);
    expect(flowErrors(validateFlow(tooLate, "message"))).toEqual([expect.objectContaining({ nodeId: "b" })]);
  });

  it("requires a reachable message and reports loose blocks as warnings only", () => {
    const graph = flow([message("a", "")], []);
    const issues = validateFlow(graph, "message");
    expect(flowErrors(issues).map(issue => issue.message)).toEqual(["Ligue ao menos uma mensagem ao gatilho"]);
    expect(issues).toContainEqual(expect.objectContaining({ nodeId: "a", level: "warning" }));
  });

  it("validates message fields, buttons and actions", () => {
    const graph = flow([
      message("a", "x".repeat(700), [{ id: "l", label: "Site", kind: "url", url: "http://inseguro.com" }]),
      { id: "c", type: "action", position: { x: 0, y: 0 }, data: { kind: "crm", crm: { pipelineId: null, stageId: null, originId: null, assignedTo: null, dealValue: 0 } } },
    ], [["trigger", "next", "a"], ["a", "next", "c"]]);
    const messages = flowErrors(validateFlow(graph, "message")).map(issue => issue.message);
    expect(messages).toContain("Mensagens com botões aceitam até 640 caracteres");
    expect(messages).toContain('O botão "Site" precisa de um link HTTPS');
    expect(messages).toContain("Selecione a pipeline e a etapa do CRM");
  });

  it("survives cycles", () => {
    const graph = flow([
      message("a", "Escolha", [{ id: "x", label: "De novo", kind: "reply" }]),
    ], [["trigger", "next", "a"], ["a", "button:x", "a"]]);
    expect(() => validateFlow(sanitizeFlow(graph), "message")).not.toThrow();
  });
});

describe("flow sanitization", () => {
  it("normalizes payloads and drops edges to missing handles", () => {
    const sanitized = sanitizeFlow({
      nodes: [
        { id: "trigger", type: "trigger", position: { x: "10", y: 5.6 } },
        { id: "m", type: "message", data: { text: "  Oi  ", buttons: [{ id: "b1", label: "Quero saber mais sobre", kind: "reply" }], timeoutMinutes: "30" } },
        { id: "z", type: "delay", data: { minutes: 999999 } },
      ],
      edges: [
        { id: "e1", source: "trigger", sourceHandle: "next", target: "m" },
        { id: "e2", source: "m", sourceHandle: "next", target: "z" },
        { id: "e3", source: "m", sourceHandle: "button:b1", target: "z" },
        { id: "e4", source: "z", sourceHandle: "next", target: "trigger" },
      ],
    });
    expect(sanitized.nodes[0].position).toEqual({ x: 10, y: 6 });
    expect(sanitized.nodes[1]).toMatchObject({ data: { text: "Oi", timeoutMinutes: 30, buttons: [{ label: "Quero saber mais sob" }] } });
    expect(sanitized.nodes[2]).toMatchObject({ data: { minutes: 10080 } });
    expect(sanitized.edges.map(edge => edge.id)).toEqual(["e1", "e3"]);
  });

  it("rejects flows without exactly one trigger or with unknown blocks", () => {
    expect(() => sanitizeFlow({ nodes: [], edges: [] })).toThrow("único gatilho");
    expect(() => sanitizeFlow({ nodes: [{ id: "trigger", type: "trigger" }, { id: "x", type: "hack" }], edges: [] })).toThrow("desconhecido");
    expect(() => sanitizeFlow({ nodes: Array.from({ length: 41 }, (_, i) => ({ id: `n${i}`, type: "message" })), edges: [] })).toThrow("no máximo");
  });
});

describe("graph editing helpers", () => {
  it("replaces the edge leaving a handle and never targets the trigger", () => {
    const base = emptyFlow();
    const first = base.nodes[1].id;
    const extra: FlowNode = message("x", "Outro");
    const withExtra = { ...base, nodes: [...base.nodes, extra] };
    const rewired = connectNodes(withExtra, "trigger", "next", "x");
    expect(rewired.edges.filter(edge => edge.source === "trigger")).toHaveLength(1);
    expect(nextNodeId(rewired, "trigger", "next")).toBe("x");
    expect(connectNodes(rewired, first, "next", "trigger")).toBe(rewired);
    expect(removeFlowNode(rewired, "x").edges).toHaveLength(0);
    expect(removeFlowNode(rewired, "trigger")).toBe(rewired);
  });

  it("exposes one output per reply button plus the optional timeout", () => {
    const node = message("m", "Oi", [{ id: "a", label: "A", kind: "reply" }, { id: "l", label: "Site", kind: "url", url: "https://a.com" }], 60);
    expect(nodeOutputs(node).map(output => output.handle)).toEqual(["button:a", "timeout"]);
    const withoutReply = message("m", "Oi", [{ id: "l", label: "Site", kind: "url", url: "https://a.com" }]);
    const graph = flow([node], [["trigger", "next", "m"], ["m", "button:a", "m"]]);
    const pruned = pruneDanglingEdges({ ...graph, nodes: [graph.nodes[0], withoutReply] });
    expect(pruned.edges.map(edge => edge.sourceHandle)).toEqual(["next"]);
  });
});

describe("flow runtime rules", () => {
  it("round-trips button payloads and rejects foreign ones", () => {
    const payload = buildFlowPayload(RUN, "msg_1", "b2");
    expect(parseFlowPayload(payload)).toEqual({ runId: RUN, nodeId: "msg_1", buttonId: "b2" });
    expect(parseFlowPayload("igflow:not-a-uuid:a:b")).toBeNull();
    expect(parseFlowPayload("QUERO")).toBeNull();
  });

  it("opens 24h after the last message and up to 7 days for ad conversations", () => {
    const now = new Date("2026-11-25T12:00:00Z");
    expect(contactWindow({ lastMessageAt: "2026-11-24T13:00:00Z", adWindowUntil: null }, now)).toMatchObject({ open: true, source: "organic" });
    expect(contactWindow({ lastMessageAt: "2026-11-24T11:00:00Z", adWindowUntil: null }, now).open).toBe(false);
    expect(contactWindow({ lastMessageAt: "2026-11-22T11:00:00Z", adWindowUntil: "2026-11-28T11:00:00Z" }, now)).toMatchObject({ open: true, source: "ad" });
    expect(contactWindow({ lastMessageAt: null, adWindowUntil: null }, now).open).toBe(false);
  });

  it("uses the private reply once and then requires the messaging window", () => {
    const now = new Date("2026-11-25T12:00:00Z");
    expect(messageDelivery({ isCommentRun: true, privateReplyUsed: false, commentAt: "2026-11-20T12:00:00Z", window: { open: false }, now }).channel).toBe("private_reply");
    expect(messageDelivery({ isCommentRun: true, privateReplyUsed: false, commentAt: "2026-11-10T12:00:00Z", window: { open: true }, now }).channel).toBeNull();
    expect(messageDelivery({ isCommentRun: true, privateReplyUsed: true, commentAt: "2026-11-25T11:00:00Z", window: { open: false }, now })).toMatchObject({ channel: null });
    expect(messageDelivery({ isCommentRun: false, privateReplyUsed: false, commentAt: null, window: { open: true }, now }).channel).toBe("dm");
  });

  it("evaluates conditions with accent- and case-insensitive matching", () => {
    const context = { lastReply: "Quero o APARTAMENTO de 2 quartos", tags: ["Lançamento"], fromAd: false };
    expect(evaluateCondition({ kind: "reply_contains", value: "casa, apartamento" }, context)).toBe(true);
    expect(evaluateCondition({ kind: "reply_contains", value: "cobertura" }, context)).toBe(false);
    expect(evaluateCondition({ kind: "has_tag", value: "lancamento" }, context)).toBe(true);
    expect(evaluateCondition({ kind: "from_ad", value: "" }, { ...context, fromAd: true })).toBe(true);
    expect(evaluateCondition({ kind: "reply_contains", value: "sim" }, { ...context, lastReply: null })).toBe(false);
  });

  it("builds postback buttons for replies and web_url buttons for links", () => {
    const body = instagramMessageBody({
      text: "Escolha", timeoutMinutes: null,
      buttons: [{ id: "a", label: "Quero", kind: "reply" }, { id: "l", label: "Site", kind: "url", url: "https://a.com" }],
    }, id => `payload-${id}`);
    expect(body).toEqual({ attachment: { type: "template", payload: { template_type: "button", text: "Escolha", buttons: [
      { type: "postback", title: "Quero", payload: "payload-a" },
      { type: "web_url", url: "https://a.com", title: "Site" },
    ] } } });
    expect(instagramMessageBody({ text: "Oi", buttons: [], timeoutMinutes: null }, id => id)).toEqual({ text: "Oi" });
  });
});
