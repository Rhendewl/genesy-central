import {
  FLOW_FIELD_LABELS,
  FLOW_NODE_LABELS,
  FLOW_TRIGGER_ID,
  type AutomationFlow,
  type FlowEdge,
  type FlowNode,
  type FlowNodeType,
  type FlowPosition,
} from "./types";

export interface FlowOutput { handle: string; label: string }

export function flowId(prefix = "n") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

/** Output handles a node exposes. The editor draws one connector per handle. */
export function nodeOutputs(node: FlowNode): FlowOutput[] {
  switch (node.type) {
    case "trigger":
    case "delay":
    case "action":
      return [{ handle: "next", label: "Em seguida" }];
    case "wait_reply": {
      const outputs = [{ handle: "reply", label: "Respondeu" }];
      // WhatsApp and e-mail are validated; an answer that doesn't look like one gets its own branch.
      if (node.data.saveAs === "phone" || node.data.saveAs === "email") outputs.push({ handle: "invalid", label: "Resposta inválida" });
      outputs.push({ handle: "timeout", label: "Sem resposta" });
      return outputs;
    }
    case "condition":
      return [{ handle: "yes", label: "Sim" }, { handle: "no", label: "Não" }];
    case "message": {
      const replies = node.data.buttons.filter(button => button.kind === "reply");
      if (!replies.length) return [{ handle: "next", label: "Em seguida" }];
      const outputs = replies.map(button => ({ handle: `button:${button.id}`, label: button.label || "Botão" }));
      if (node.data.timeoutMinutes) outputs.push({ handle: "timeout", label: "Não tocou" });
      return outputs;
    }
  }
}

/** True when this node stops the run until the contact interacts. */
/** Outputs that only fire after the contact answered or tapped (they open Meta's window). */
export function isInteractionHandle(handle: string) {
  return handle === "reply" || handle === "invalid" || handle.startsWith("button:");
}

export function nodeWaitsForContact(node: FlowNode) {
  if (node.type === "wait_reply") return true;
  return node.type === "message" && node.data.buttons.some(button => button.kind === "reply");
}

export function findNode(flow: AutomationFlow, id: string | null | undefined) {
  return id ? flow.nodes.find(node => node.id === id) ?? null : null;
}

export function nextNodeId(flow: AutomationFlow, nodeId: string, handle: string) {
  return flow.edges.find(edge => edge.source === nodeId && edge.sourceHandle === handle)?.target ?? null;
}

export function createFlowNode(type: Exclude<FlowNodeType, "trigger">, position: FlowPosition): FlowNode {
  const id = flowId(type === "wait_reply" ? "wait" : type);
  switch (type) {
    case "message": return { id, type, position, data: { text: "", buttons: [], timeoutMinutes: null } };
    case "delay": return { id, type, position, data: { seconds: 10, typing: true } };
    case "wait_reply": return { id, type, position, data: { timeoutMinutes: 60, saveAs: null } };
    case "condition": return { id, type, position, data: { kind: "reply_contains", value: "" } };
    case "action": return {
      id, type, position,
      data: { kind: "crm", crm: { pipelineId: null, stageId: null, originId: null, assignedTo: null, dealValue: 0 } },
    };
  }
}

export function emptyFlow(): AutomationFlow {
  const message = createFlowNode("message", { x: 380, y: 40 });
  return {
    version: 1,
    nodes: [{ id: FLOW_TRIGGER_ID, type: "trigger", position: { x: 40, y: 40 }, data: {} }, message],
    edges: [{ id: flowId("e"), source: FLOW_TRIGGER_ID, sourceHandle: "next", target: message.id }],
  };
}

/** Connects source:handle → target, replacing whatever that handle pointed to. */
export function connectNodes(flow: AutomationFlow, source: string, sourceHandle: string, target: string): AutomationFlow {
  if (source === target || target === FLOW_TRIGGER_ID) return flow;
  const edges = flow.edges.filter(edge => !(edge.source === source && edge.sourceHandle === sourceHandle));
  return { ...flow, edges: [...edges, { id: flowId("e"), source, sourceHandle, target }] };
}

/** Drops edges whose handle no longer exists (e.g. a reply button was removed). */
export function pruneDanglingEdges(flow: AutomationFlow): AutomationFlow {
  const nodes = new Map(flow.nodes.map(node => [node.id, node]));
  const edges = flow.edges.filter((edge: FlowEdge) => {
    const source = nodes.get(edge.source);
    if (!source || !nodes.has(edge.target)) return false;
    return nodeOutputs(source).some(output => output.handle === edge.sourceHandle);
  });
  return edges.length === flow.edges.length ? flow : { ...flow, edges };
}

/** Copies a block (not its links) next to the original; buttons get new ids. */
export function duplicateFlowNode(flow: AutomationFlow, nodeId: string): { flow: AutomationFlow; node: FlowNode | null } {
  const original = flow.nodes.find(node => node.id === nodeId);
  if (!original || original.type === "trigger") return { flow, node: null };
  const copy = JSON.parse(JSON.stringify(original)) as FlowNode;
  copy.id = flowId(original.type === "wait_reply" ? "wait" : original.type);
  // Below the original, so the copy never covers its connectors.
  const height = original.type === "delay" ? 64 : 46 + 56 + nodeOutputs(original).length * 30 + 10;
  copy.position = { x: original.position.x, y: original.position.y + height + 48 };
  if (copy.type === "message") copy.data.buttons = copy.data.buttons.map(button => ({ ...button, id: flowId("b") }));
  return { flow: { ...flow, nodes: [...flow.nodes, copy] }, node: copy };
}

export function removeFlowNode(flow: AutomationFlow, nodeId: string): AutomationFlow {
  if (nodeId === FLOW_TRIGGER_ID) return flow;
  return {
    ...flow,
    nodes: flow.nodes.filter(node => node.id !== nodeId),
    edges: flow.edges.filter(edge => edge.source !== nodeId && edge.target !== nodeId),
  };
}

export function formatSeconds(seconds: number) {
  const value = Math.max(0, Math.round(seconds));
  if (value < 60) return `${value}s`;
  if (value % 60 === 0) return formatMinutes(value / 60);
  return `${Math.floor(value / 60)}min${String(value % 60).padStart(2, "0")}`;
}

export function formatMinutes(minutes: number) {
  const value = Math.max(0, Math.round(minutes));
  if (value >= 1440 && value % 1440 === 0) return `${value / 1440} dia${value === 1440 ? "" : "s"}`;
  if (value >= 60 && value % 60 === 0) return `${value / 60}h`;
  if (value >= 60) return `${Math.floor(value / 60)}h${String(value % 60).padStart(2, "0")}`;
  return `${value} min`;
}

/** One-line human summary used by the canvas and the automation list. */
export function describeNode(node: FlowNode): string {
  switch (node.type) {
    case "trigger": return "Início do fluxo";
    case "message": return node.data.text.trim() || "Escreva a mensagem";
    case "delay": return formatSeconds(node.data.seconds);
    case "wait_reply": {
      const save = node.data.saveAs
        ? ` · salva ${node.data.saveAs === "custom" ? (node.data.fieldLabel || "campo") : FLOW_FIELD_LABELS[node.data.saveAs]}`
        : "";
      return `Até ${formatMinutes(node.data.timeoutMinutes)} pela resposta${save}`;
    }
    case "condition":
      if (node.data.kind === "from_ad") return "Lead veio de anúncio?";
      if (node.data.kind === "has_tag") return node.data.value ? `Tem a tag "${node.data.value}"?` : "Escolha a tag";
      return node.data.value ? `Resposta contém "${node.data.value}"?` : "Defina o texto";
    case "action":
      if (node.data.kind === "add_tag") return node.data.tag ? `Adiciona a tag "${node.data.tag}"` : "Escolha a tag";
      return "Cria oportunidade no CRM";
  }
}

export function nodeTitle(node: FlowNode) {
  if (node.type === "action") return node.data.kind === "crm" ? "CRM" : "Tag";
  return FLOW_NODE_LABELS[node.type];
}

export function flowStats(flow: AutomationFlow | null | undefined) {
  const nodes = flow?.nodes ?? [];
  return {
    blocks: Math.max(0, nodes.length - 1),
    messages: nodes.filter(node => node.type === "message").length,
    hasCrm: nodes.some(node => node.type === "action" && node.data.kind === "crm"),
    hasBranches: nodes.some(node => node.type === "condition" || nodeWaitsForContact(node)),
  };
}
