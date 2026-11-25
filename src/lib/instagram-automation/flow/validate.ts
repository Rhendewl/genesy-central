import { nodeOutputs, pruneDanglingEdges } from "./graph";
import {
  FLOW_MAX_BUTTONS,
  FLOW_MAX_BUTTON_LABEL,
  FLOW_MAX_NODES,
  FLOW_MAX_TEXT,
  FLOW_MAX_TEXT_WITH_BUTTONS,
  FLOW_MAX_WAIT_MINUTES,
  FLOW_TRIGGER_ID,
  type ActionNodeData,
  type AutomationFlow,
  type ConditionNodeData,
  type FlowButton,
  type FlowEdge,
  type FlowIssue,
  type FlowNode,
  type MessageNodeData,
} from "./types";

/** Minutes an automated message may follow the contact's last interaction (24h window minus margin). */
export const FLOW_STANDARD_WINDOW_MINUTES = 23 * 60;

const ID_PATTERN = /^[A-Za-z0-9_-]{1,48}$/;

function badRequest(message: string) {
  return Object.assign(new Error(message), { status: 400 });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function cleanId(value: unknown, fallback: string) {
  const id = String(value ?? "");
  return ID_PATTERN.test(id) ? id : fallback;
}

function clampMinutes(value: unknown, min: number) {
  const minutes = Math.round(Number(value));
  if (!Number.isFinite(minutes)) return min;
  return Math.min(FLOW_MAX_WAIT_MINUTES, Math.max(min, minutes));
}

function nullableId(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, 64) : null;
}

function sanitizeMessage(raw: Record<string, unknown>): MessageNodeData {
  const seen = new Set<string>();
  const buttons: FlowButton[] = (Array.isArray(raw.buttons) ? raw.buttons : []).slice(0, FLOW_MAX_BUTTONS).map((value, index) => {
    const button = asRecord(value);
    let id = cleanId(button.id, `b${index}`);
    while (seen.has(id)) id = `${id}_${index}`;
    seen.add(id);
    const kind = button.kind === "reply" ? "reply" : "url";
    return {
      id, kind,
      label: String(button.label ?? "").trim().slice(0, FLOW_MAX_BUTTON_LABEL),
      ...(kind === "url" ? { url: String(button.url ?? "").trim().slice(0, 2000) } : {}),
    };
  });
  const hasReply = buttons.some(button => button.kind === "reply");
  const timeout = raw.timeoutMinutes === null || raw.timeoutMinutes === undefined || raw.timeoutMinutes === "" ? null : clampMinutes(raw.timeoutMinutes, 1);
  return { text: String(raw.text ?? "").trim().slice(0, FLOW_MAX_TEXT), buttons, timeoutMinutes: hasReply ? timeout : null };
}

function sanitizeCondition(raw: Record<string, unknown>): ConditionNodeData {
  const kind = raw.kind === "has_tag" || raw.kind === "from_ad" ? raw.kind : "reply_contains";
  return { kind, value: kind === "from_ad" ? "" : String(raw.value ?? "").trim().slice(0, 120) };
}

function sanitizeAction(raw: Record<string, unknown>): ActionNodeData {
  if (raw.kind === "add_tag") return { kind: "add_tag", tag: String(raw.tag ?? "").trim().slice(0, 40) };
  const crm = asRecord(raw.crm);
  return {
    kind: "crm",
    crm: {
      pipelineId: nullableId(crm.pipelineId),
      stageId: nullableId(crm.stageId),
      originId: nullableId(crm.originId),
      assignedTo: nullableId(crm.assignedTo),
      dealValue: Math.min(999_999_999_999, Math.max(0, Number(crm.dealValue ?? 0) || 0)),
    },
  };
}

/** Normalizes an untrusted flow payload. Throws (status 400) on structural problems. */
export function sanitizeFlow(value: unknown): AutomationFlow {
  const raw = asRecord(value);
  if (!Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) throw badRequest("Fluxo inválido");
  if (raw.nodes.length > FLOW_MAX_NODES) throw badRequest(`O fluxo pode ter no máximo ${FLOW_MAX_NODES} blocos`);
  const ids = new Set<string>();
  const nodes = raw.nodes.map((entry, index): FlowNode => {
    const node = asRecord(entry);
    const id = cleanId(node.id, `node_${index}`);
    if (ids.has(id)) throw badRequest("O fluxo tem blocos repetidos");
    ids.add(id);
    const position = asRecord(node.position);
    const pos = {
      x: Math.round(Math.max(-100_000, Math.min(100_000, Number(position.x) || 0))),
      y: Math.round(Math.max(-100_000, Math.min(100_000, Number(position.y) || 0))),
    };
    const data = asRecord(node.data);
    switch (node.type) {
      case "trigger": return { id, type: "trigger", position: pos, data: {} };
      case "message": return { id, type: "message", position: pos, data: sanitizeMessage(data) };
      case "delay": return { id, type: "delay", position: pos, data: { minutes: clampMinutes(data.minutes, 1) } };
      case "wait_reply": return { id, type: "wait_reply", position: pos, data: { timeoutMinutes: clampMinutes(data.timeoutMinutes, 1) } };
      case "condition": return { id, type: "condition", position: pos, data: sanitizeCondition(data) };
      case "action": return { id, type: "action", position: pos, data: sanitizeAction(data) };
      default: throw badRequest("O fluxo tem um tipo de bloco desconhecido");
    }
  });
  const triggers = nodes.filter(node => node.type === "trigger");
  if (triggers.length !== 1 || triggers[0].id !== FLOW_TRIGGER_ID) throw badRequest("O fluxo precisa de um único gatilho");

  const byHandle = new Map<string, FlowEdge>();
  raw.edges.slice(0, FLOW_MAX_NODES * 4).forEach((entry, index) => {
    const edge = asRecord(entry);
    const source = String(edge.source ?? "");
    const target = String(edge.target ?? "");
    const sourceHandle = String(edge.sourceHandle ?? "next").slice(0, 60);
    if (!ids.has(source) || !ids.has(target) || source === target || target === FLOW_TRIGGER_ID) return;
    byHandle.set(`${source}|${sourceHandle}`, { id: cleanId(edge.id, `e${index}`), source, sourceHandle, target });
  });
  return pruneDanglingEdges({ version: 1, nodes, edges: Array.from(byHandle.values()) });
}

function validateNode(node: FlowNode, issues: FlowIssue[]) {
  const error = (message: string) => issues.push({ nodeId: node.id, level: "error", message });
  if (node.type === "message") {
    const { text, buttons } = node.data;
    if (!text) error("Escreva o texto da mensagem");
    if (buttons.length && text.length > FLOW_MAX_TEXT_WITH_BUTTONS) error(`Mensagens com botões aceitam até ${FLOW_MAX_TEXT_WITH_BUTTONS} caracteres`);
    for (const button of buttons) {
      if (!button.label) error("Dê um título a cada botão");
      if (button.kind === "url") {
        let url: URL | null = null;
        try { url = new URL(button.url ?? ""); } catch { url = null; }
        if (!url || url.protocol !== "https:" || url.username || url.password) error(`O botão "${button.label || "sem título"}" precisa de um link HTTPS`);
      }
    }
  }
  if (node.type === "condition" && node.data.kind !== "from_ad" && !node.data.value) error("Defina o valor da condição");
  if (node.type === "action") {
    if (node.data.kind === "add_tag" && !node.data.tag) error("Informe o nome da tag");
    if (node.data.kind === "crm" && (!node.data.crm?.pipelineId || !node.data.crm?.stageId)) error("Selecione a pipeline e a etapa do CRM");
  }
}

/**
 * Checks a flow against the editor rules and Meta's messaging policy.
 * Errors block activation; warnings are shown in the editor only.
 */
export function validateFlow(flow: AutomationFlow, triggerType: string): FlowIssue[] {
  const issues: FlowIssue[] = [];
  const nodes = new Map(flow.nodes.map(node => [node.id, node]));

  const reachable = new Set<string>();
  const reported = new Set<string>();
  const report = (nodeId: string, level: FlowIssue["level"], message: string) => {
    const key = `${nodeId}|${message}`;
    if (reported.has(key)) return;
    reported.add(key);
    issues.push({ nodeId, level, message });
  };
  const isComment = triggerType === "comment";
  const visited = new Set<string>();
  // Walks every path keeping what Meta cares about: whether the contact has
  // interacted (opening the 24h window), whether the single private reply of a
  // comment was used, and how long since the last interaction.
  const walk = (nodeId: string, interacted: boolean, sentPrivate: boolean, elapsed: number) => {
    const key = `${nodeId}|${interacted}|${sentPrivate}`;
    if (visited.has(key)) return;
    visited.add(key);
    reachable.add(nodeId);
    const node = nodes.get(nodeId);
    if (!node) return;
    let nextSentPrivate = sentPrivate;
    if (node.type === "message") {
      if (!interacted) {
        if (sentPrivate) {
          report(node.id, "error", "Depois da resposta privada, a conversa só continua quando o lead interage. Use um botão de resposta ou o bloco Esperar resposta antes desta mensagem.");
        } else if (elapsed > FLOW_MAX_WAIT_MINUTES) {
          report(node.id, "error", "A resposta privada precisa sair em até 7 dias depois do comentário");
        }
        nextSentPrivate = true;
      } else if (elapsed > FLOW_MAX_WAIT_MINUTES) {
        report(node.id, "error", "Nenhuma mensagem automática pode sair mais de 7 dias depois da última interação do lead");
      } else if (elapsed > FLOW_STANDARD_WINDOW_MINUTES) {
        report(node.id, "warning", "Fora da janela de 24h: só será entregue a leads que vieram de anúncio (até 7 dias)");
      }
    }
    if (node.type === "condition" && node.data.kind === "reply_contains" && isComment && !interacted) {
      report(node.id, "warning", "Ainda não há resposta do lead neste ponto; a condição seguirá por \"Não\"");
    }
    for (const output of nodeOutputs(node)) {
      const target = flow.edges.find(edge => edge.source === node.id && edge.sourceHandle === output.handle)?.target;
      const interaction = output.handle === "reply" || output.handle.startsWith("button:");
      if (!target) {
        if (interaction) report(node.id, "warning", `A saída "${output.label}" não está ligada a nenhum bloco`);
        continue;
      }
      let added = 0;
      if (node.type === "delay") added = node.data.minutes;
      if (output.handle === "timeout") added = node.type === "wait_reply" ? node.data.timeoutMinutes : node.type === "message" ? node.data.timeoutMinutes ?? 0 : 0;
      walk(target, interacted || interaction, nextSentPrivate, interaction ? 0 : elapsed + added);
    }
  };
  walk(FLOW_TRIGGER_ID, !isComment, false, 0);

  if (![...reachable].some(id => nodes.get(id)?.type === "message")) {
    issues.push({ nodeId: FLOW_TRIGGER_ID, level: "error", message: "Ligue ao menos uma mensagem ao gatilho" });
  }
  // Loose blocks never run, so their incomplete fields must not block activation.
  for (const node of flow.nodes) {
    if (reachable.has(node.id)) validateNode(node, issues);
    else issues.push({ nodeId: node.id, level: "warning", message: "Bloco solto: ligue-o ao fluxo ou remova" });
  }
  return issues;
}

export function flowErrors(issues: FlowIssue[]) {
  return issues.filter(issue => issue.level === "error");
}
