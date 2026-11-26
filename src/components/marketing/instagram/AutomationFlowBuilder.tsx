"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import {
  AlertTriangle, CheckCircle2, Copy, GitBranch, Hourglass, Link2, Maximize2, MessageSquareText, Minus, MousePointerClick,
  Plus, Tag, Target, Timer, Trash2, Workflow, X, Zap,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { LeadOriginSelector } from "@/components/crm/LeadOriginSelector";
import {
  FLOW_FIELD_LABELS,
  FLOW_INLINE_DELAY_SECONDS,
  FLOW_MAX_BUTTONS,
  FLOW_MAX_BUTTON_LABEL,
  FLOW_MAX_NODES,
  FLOW_MAX_TEXT,
  FLOW_MAX_TEXT_WITH_BUTTONS,
  FLOW_TRIGGER_ID,
  FLOW_VARIABLES,
  connectNodes,
  createFlowNode,
  describeNode,
  duplicateFlowNode,
  fieldSlug,
  flowId,
  formatSeconds,
  nextNodeId,
  nodeOutputs,
  nodeTitle,
  pruneDanglingEdges,
  removeFlowNode,
  validateFlow,
  type ActionNodeData,
  type AutomationFlow,
  type CollectedFieldKind,
  type ConditionNodeData,
  type FlowButton,
  type FlowIssue,
  type FlowNode,
  type FlowNodeType,
  type MessageNodeData,
  type WaitReplyNodeData,
} from "@/lib/instagram-automation/flow";
import { PostScopeField, PostStack } from "./AutomationPostPicker";
import "./automation-flow.css";

export type BuilderTrigger = "comment" | "message" | "story_reply" | "postback";
export type BuilderMatch = "contains" | "exact" | "starts_with" | "any";
export type BuilderStatus = "draft" | "active" | "paused";
export interface BuilderState {
  name: string;
  connectionId: string;
  status: BuilderStatus;
  triggerType: BuilderTrigger;
  matchType: BuilderMatch;
  keywords: string;
  publicReplyText: string;
  /** Comment triggers: all posts, or only the posts in mediaIds. */
  postScope: "all" | "specific";
  mediaIds: string[];
  flow: AutomationFlow;
}
export type BuilderConnection = { id: string; username: string };
export type BuilderPipeline = { id: string; name: string; crm_stages: Array<{ id: string; name: string; is_active: boolean; order_index: number }> };
export type BuilderProfile = { id: string; full_name: string; job_title: string | null };

type AddableType = Exclude<FlowNodeType, "trigger"> | "tag";

const NODE_W = 248;
/** The delay block is a small round clock. */
const DELAY_D = 64;
const HEADER_H = 46;
const BODY_H = 56;
const ROW_H = 30;
const FOOT_H = 10;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 1.6;

const TRIGGER_LABELS: Record<BuilderTrigger, string> = {
  comment: "Comentar em uma publicação",
  message: "Enviar uma mensagem",
  story_reply: "Responder a um story",
  postback: "Tocar em um botão",
};
const TRIGGER_SHORT: Record<BuilderTrigger, string> = {
  comment: "Comentário", message: "Mensagem no Direct", story_reply: "Resposta a story", postback: "Toque em botão",
};

const PALETTE: Array<{ type: AddableType; label: string; icon: typeof Zap }> = [
  { type: "message", label: "Mensagem", icon: MessageSquareText },
  { type: "delay", label: "Atraso", icon: Timer },
  { type: "wait_reply", label: "Aguardar resposta", icon: Hourglass },
  { type: "condition", label: "Condição", icon: GitBranch },
  { type: "action", label: "CRM", icon: Target },
  { type: "tag", label: "Tag", icon: Tag },
];

function nodeIcon(node: FlowNode) {
  switch (node.type) {
    case "trigger": return Zap;
    case "message": return MessageSquareText;
    case "delay": return Timer;
    case "wait_reply": return Hourglass;
    case "condition": return GitBranch;
    case "action": return node.data.kind === "add_tag" ? Tag : Target;
  }
}

function nodeWidth(node: FlowNode) {
  return node.type === "delay" ? DELAY_D : NODE_W;
}
/** Blocks with one plain "Em seguida" output show no output rows: the dot sits mid-right. */
function hasSingleNext(node: FlowNode) {
  const outputs = nodeOutputs(node);
  return outputs.length === 1 && outputs[0].handle === "next";
}
/** Height of a block with no output rows; also used to place a new block on a drop. */
const PLAIN_NODE_H = HEADER_H + BODY_H + FOOT_H;
function nodeHeight(node: FlowNode) {
  if (node.type === "delay") return DELAY_D;
  return hasSingleNext(node) ? PLAIN_NODE_H : HEADER_H + BODY_H + nodeOutputs(node).length * ROW_H + FOOT_H;
}
/** Where an incoming line ends: just outside the input dot so the arrowhead shows. */
function inPort(node: FlowNode) {
  return { x: node.position.x - 8, y: node.position.y + nodeHeight(node) / 2 };
}
function inDot(node: FlowNode) {
  return { x: node.position.x, y: node.position.y + nodeHeight(node) / 2 };
}
function outPort(node: FlowNode, index: number) {
  if (node.type === "delay" || hasSingleNext(node)) return { x: node.position.x + nodeWidth(node), y: node.position.y + nodeHeight(node) / 2 };
  return { x: node.position.x + NODE_W, y: node.position.y + HEADER_H + BODY_H + index * ROW_H + ROW_H / 2 };
}
/** Canvas width not covered by the floating glass panel (desktop layout). */
function visibleCanvasWidth(canvas: HTMLElement) {
  const rect = canvas.getBoundingClientRect();
  const panel = canvas.parentElement?.querySelector<HTMLElement>(".ig-flow-inspector")?.getBoundingClientRect();
  const covered = panel && panel.top < rect.bottom - 40 && panel.left < rect.right && panel.left > rect.left ? rect.right - panel.left : 0;
  return rect.width - covered;
}
function curve(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = Math.max(56, Math.abs(b.x - a.x) / 2);
  const c1 = { x: a.x + dx, y: a.y };
  const c2 = { x: b.x - dx, y: b.y };
  const mid = {
    x: 0.125 * a.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * b.x,
    y: 0.125 * a.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * b.y,
  };
  return { d: `M${a.x},${a.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${b.x},${b.y}`, mid };
}

/** Messages that go out as the single private reply of a comment. */
function privateReplyIds(flow: AutomationFlow, triggerType: BuilderTrigger) {
  const result = new Set<string>();
  if (triggerType !== "comment") return result;
  const seen = new Set<string>();
  const queue = [FLOW_TRIGGER_ID];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = flow.nodes.find(item => item.id === id);
    if (!node) continue;
    if (node.type === "message") { result.add(id); continue; }
    for (const output of nodeOutputs(node)) {
      if (output.handle === "reply" || output.handle.startsWith("button:")) continue;
      const target = nextNodeId(flow, id, output.handle);
      if (target) queue.push(target);
    }
  }
  return result;
}

export function keywordList(value: string) {
  return value.split(/[\n,]/).map(item => item.trim()).filter(Boolean);
}

/** Starter graph that already follows Meta's comment rule: a reply button opens the conversation. */
export function starterFlow(): AutomationFlow {
  const first = createFlowNode("message", { x: 360, y: 60 });
  const second = createFlowNode("message", { x: 700, y: 60 });
  const buttonId = flowId("b");
  if (first.type === "message") first.data = { text: "Oi! Toque no botão abaixo que eu te mando agora.", buttons: [{ id: buttonId, kind: "reply", label: "Quero receber" }], timeoutMinutes: null };
  return {
    version: 1,
    nodes: [{ id: FLOW_TRIGGER_ID, type: "trigger", position: { x: 40, y: 60 }, data: {} }, first, second],
    edges: [
      { id: flowId("e"), source: FLOW_TRIGGER_ID, sourceHandle: "next", target: first.id },
      { id: flowId("e"), source: first.id, sourceHandle: `button:${buttonId}`, target: second.id },
    ],
  };
}

type Gesture =
  | { kind: "pan"; startX: number; startY: number; originX: number; originY: number; moved: boolean }
  | { kind: "drag"; id: string; startX: number; startY: number; originX: number; originY: number; moved: boolean }
  | { kind: "connect"; source: string; handle: string };

export function AutomationFlowBuilder({
  open, initial, editing, connections, pipelines, profiles, saving, onClose, onSave,
}: {
  open: boolean;
  initial: BuilderState;
  editing: boolean;
  connections: BuilderConnection[];
  pipelines: BuilderPipeline[];
  profiles: BuilderProfile[];
  saving: boolean;
  onClose: () => void;
  onSave: (state: BuilderState) => void;
}) {
  const [state, setState] = useState<BuilderState>(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [view, setView] = useState({ x: 40, y: 40, k: 1 });
  const [connecting, setConnecting] = useState<{ source: string; handle: string; x: number; y: number; target: string | null } | null>(null);
  const [dropMenu, setDropMenu] = useState<{ source: string; handle: string; x: number; y: number; screenX: number; screenY: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  // The dialog mounts its content after `open` flips, so listeners that need the
  // canvas element hang on this state instead of the ref.
  const [canvasEl, setCanvasEl] = useState<HTMLDivElement | null>(null);
  const attachCanvas = useCallback((element: HTMLDivElement | null) => { canvasRef.current = element; setCanvasEl(element); }, []);
  const gesture = useRef<Gesture | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    if (!open) return;
    setState(initial);
    setSelected(null);
    setSelectedEdge(null);
    setDropMenu(null);
  }, [initial, open]);

  const { flow } = state;
  const setFlow = useCallback((updater: (current: AutomationFlow) => AutomationFlow) => {
    setState(current => ({ ...current, flow: pruneDanglingEdges(updater(current.flow)) }));
  }, []);
  const updateData = useCallback((id: string, data: Record<string, unknown>) => {
    setFlow(current => ({
      ...current,
      nodes: current.nodes.map(node => node.id === id ? ({ ...node, data: { ...node.data, ...data } } as FlowNode) : node),
    }));
  }, [setFlow]);

  const privateReplies = useMemo(() => privateReplyIds(flow, state.triggerType), [flow, state.triggerType]);
  const messageVariables = useMemo(() => {
    const custom = flow.nodes.flatMap(node => node.type === "wait_reply" && node.data.saveAs === "custom" && node.data.fieldLabel
      ? [{ key: fieldSlug(node.data.fieldLabel), label: node.data.fieldLabel }] : []);
    return [...FLOW_VARIABLES, ...custom.filter((item, index) => item.key && custom.findIndex(other => other.key === item.key) === index)];
  }, [flow.nodes]);
  const issues = useMemo(() => {
    const list: FlowIssue[] = [];
    if (!state.name.trim()) list.push({ nodeId: null, level: "error", message: "Dê um nome à automação" });
    if (!state.connectionId) list.push({ nodeId: null, level: "error", message: "Escolha a conta profissional" });
    if (state.matchType !== "any" && !keywordList(state.keywords).length) list.push({ nodeId: FLOW_TRIGGER_ID, level: "error", message: "Informe ao menos uma palavra ou frase" });
    const scoped = state.triggerType === "comment" && state.postScope === "specific";
    if (scoped && !state.mediaIds.length) list.push({ nodeId: FLOW_TRIGGER_ID, level: "error", message: "Escolha ao menos um post" });
    if (state.triggerType === "comment" && state.matchType === "any" && !scoped) list.push({ nodeId: FLOW_TRIGGER_ID, level: "error", message: "Qualquer comentário só vale para posts específicos" });
    return [...list, ...validateFlow(flow, state.triggerType)];
  }, [flow, state.connectionId, state.keywords, state.matchType, state.mediaIds.length, state.name, state.postScope, state.triggerType]);
  const errors = issues.filter(issue => issue.level === "error");
  // Drafts only need what the server requires to store them; anything that can run must be valid.
  const blocking = state.status === "draft" ? errors.filter(issue => issue.nodeId === null || issue.message.startsWith("Informe ao menos")) : errors;
  const issuesByNode = useMemo(() => {
    const map = new Map<string, FlowIssue[]>();
    for (const issue of issues) if (issue.nodeId) map.set(issue.nodeId, [...(map.get(issue.nodeId) ?? []), issue]);
    return map;
  }, [issues]);

  const toWorld = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const current = viewRef.current;
    return { x: (clientX - (rect?.left ?? 0) - current.x) / current.k, y: (clientY - (rect?.top ?? 0) - current.y) / current.k };
  }, []);

  /** Frames the whole flow. On open, large flows start readable from the trigger instead of tiny. */
  const fitView = useCallback((readable = false) => {
    const canvas = canvasRef.current;
    if (!canvas || !flow.nodes.length) return;
    const minX = Math.min(...flow.nodes.map(node => node.position.x));
    const minY = Math.min(...flow.nodes.map(node => node.position.y));
    const maxX = Math.max(...flow.nodes.map(node => node.position.x + nodeWidth(node)));
    const maxY = Math.max(...flow.nodes.map(node => node.position.y + nodeHeight(node)));
    const width = visibleCanvasWidth(canvas);
    const height = canvas.getBoundingClientRect().height;
    const fit = Math.min(1.05, Math.max(MIN_ZOOM, Math.min((width - 120) / (maxX - minX || 1), (height - 160) / (maxY - minY || 1))));
    const k = readable ? Math.max(fit, Math.min(0.8, width < 640 ? 0.7 : 0.8)) : fit;
    const overflows = (maxX - minX) * k > width - 80;
    const trigger = flow.nodes.find(node => node.id === FLOW_TRIGGER_ID);
    setView({
      k,
      x: overflows ? 32 - minX * k : (width - (maxX - minX) * k) / 2 - minX * k,
      y: overflows && trigger
        ? Math.max(76, height / 2 - (trigger.position.y + nodeHeight(trigger) / 2) * k)
        : Math.max(76, (height - (maxY - minY) * k) / 2) - minY * k,
    });
  }, [flow.nodes]);

  // Fit once the dialog has laid out; later edits keep the user's viewport.
  const fitted = useRef(false);
  useEffect(() => {
    if (!open) { fitted.current = false; return; }
    if (fitted.current || !canvasEl) return;
    const frame = requestAnimationFrame(() => { fitView(true); fitted.current = true; });
    return () => cancelAnimationFrame(frame);
  }, [canvasEl, fitView, open]);

  const zoomAt = useCallback((factor: number, clientX?: number, clientY?: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = clientX ?? rect.left + rect.width / 2;
    const py = clientY ?? rect.top + rect.height / 2;
    setView(current => {
      const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.k * factor));
      const wx = (px - rect.left - current.x) / current.k;
      const wy = (py - rect.top - current.y) / current.k;
      return { k, x: px - rect.left - wx * k, y: py - rect.top - wy * k };
    });
  }, []);

  useEffect(() => {
    const canvas = canvasEl;
    if (!canvas) return;
    // Ctrl/⌘ + scroll (and trackpad pinch, which arrives as ctrl + wheel) zooms
    // around the cursor; plain scroll pans, like ManyChat and Figma.
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const delta = Math.max(-80, Math.min(80, event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY));
        zoomAt(Math.exp(-delta * 0.002), event.clientX, event.clientY);
      } else {
        setView(current => ({ ...current, x: current.x - event.deltaX, y: current.y - event.deltaY }));
      }
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [canvasEl, zoomAt]);

  const addNode = useCallback((type: AddableType, at?: { x: number; y: number }, from?: { source: string; handle: string }) => {
    if (flow.nodes.length >= FLOW_MAX_NODES) return;
    const anchor = from ? flow.nodes.find(node => node.id === from.source) : selected ? flow.nodes.find(node => node.id === selected) : null;
    let position = at;
    if (!position && anchor) position = { x: anchor.position.x + nodeWidth(anchor) + 90, y: anchor.position.y };
    if (!position) {
      const rect = canvasRef.current?.getBoundingClientRect();
      position = toWorld((rect?.left ?? 0) + (rect?.width ?? 600) / 2 - NODE_W / 2, (rect?.top ?? 0) + (rect?.height ?? 400) / 3);
    }
    const node = createFlowNode(type === "tag" ? "action" : type, { x: Math.round(position.x), y: Math.round(position.y) });
    if (type === "tag" && node.type === "action") node.data = { kind: "add_tag", tag: "" };
    let link = from;
    if (!link && anchor) {
      const outputs = nodeOutputs(anchor);
      const free = outputs.find(output => !nextNodeId(flow, anchor.id, output.handle)) ?? outputs[0];
      if (free) link = { source: anchor.id, handle: free.handle };
    }
    // Linking from an output that already leads somewhere inserts the new block
    // in between instead of silently cutting the rest of the flow.
    const previousTarget = link ? nextNodeId(flow, link.source, link.handle) : null;
    if (previousTarget && !at && anchor) node.position = { x: anchor.position.x + nodeWidth(anchor) + 90, y: anchor.position.y + nodeHeight(anchor) + 60 };
    const firstOutput = nodeOutputs(node)[0]?.handle;
    setFlow(current => {
      let next: AutomationFlow = { ...current, nodes: [...current.nodes, node] };
      if (link) next = connectNodes(next, link.source, link.handle, node.id);
      if (previousTarget && firstOutput) next = connectNodes(next, node.id, firstOutput, previousTarget);
      return next;
    });
    setSelected(node.id);
    setSelectedEdge(null);
    // Pan just enough to bring the new block into view.
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const { x, y, k } = viewRef.current;
      const left = node.position.x * k + x;
      const top = node.position.y * k + y;
      const right = left + nodeWidth(node) * k;
      const bottom = top + nodeHeight(node) * k;
      const dx = right > rect.width - 40 ? rect.width - 40 - right : left < 40 ? 40 - left : 0;
      const dy = bottom > rect.height - 70 ? rect.height - 70 - bottom : top < 76 ? 76 - top : 0;
      if (dx || dy) setView(current => ({ ...current, x: current.x + dx, y: current.y + dy }));
    }
  }, [flow, selected, setFlow, toWorld]);

  const duplicateSelected = useCallback(() => {
    if (!selected || selected === FLOW_TRIGGER_ID || flow.nodes.length >= FLOW_MAX_NODES) return;
    const { flow: next, node } = duplicateFlowNode(flow, selected);
    if (!node) return;
    setFlow(() => next);
    setSelected(node.id);
    setSelectedEdge(null);
  }, [flow, selected, setFlow]);

  const removeSelected = useCallback(() => {
    if (selectedEdge) {
      setFlow(current => ({ ...current, edges: current.edges.filter(edge => edge.id !== selectedEdge) }));
      setSelectedEdge(null);
    } else if (selected && selected !== FLOW_TRIGGER_ID) {
      setFlow(current => removeFlowNode(current, selected));
      setSelected(null);
    }
  }, [selected, selectedEdge, setFlow]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.closest("input,textarea,select,[contenteditable=true]"))) return;
      if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); removeSelected(); }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") { event.preventDefault(); duplicateSelected(); }
      if (event.key === "Escape" && (dropMenu || connecting)) { event.stopPropagation(); setDropMenu(null); setConnecting(null); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [connecting, dropMenu, duplicateSelected, open, removeSelected]);

  /**
   * Magnet: while dragging a line, the nearest block within reach (over it, or
   * with its input dot within ~70px on screen) is picked as the target.
   */
  const magnetTarget = (point: { x: number; y: number }, source: string) => {
    const reach = 70 / viewRef.current.k;
    let best: string | null = null;
    let bestDistance = Infinity;
    for (const node of flow.nodes) {
      if (node.id === source || node.id === FLOW_TRIGGER_ID) continue;
      const inside = point.x >= node.position.x - 16 && point.x <= node.position.x + nodeWidth(node) + 16
        && point.y >= node.position.y - 16 && point.y <= node.position.y + nodeHeight(node) + 16;
      const dot = inDot(node);
      const distance = inside ? 0 : Math.hypot(point.x - dot.x, point.y - dot.y);
      if (distance <= reach && distance < bestDistance) { best = node.id; bestDistance = distance; }
    }
    return best;
  };

  const onCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest(".ig-flow-node,.ig-flow-floating")) return;
    setDropMenu(null);
    gesture.current = { kind: "pan", startX: event.clientX, startY: event.clientY, originX: view.x, originY: view.y, moved: false };
    canvasRef.current?.setPointerCapture(event.pointerId);
  };
  const onNodePointerDown = (event: ReactPointerEvent<HTMLDivElement>, node: FlowNode) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    setSelected(node.id);
    setSelectedEdge(null);
    setDropMenu(null);
    gesture.current = { kind: "drag", id: node.id, startX: event.clientX, startY: event.clientY, originX: node.position.x, originY: node.position.y, moved: false };
    canvasRef.current?.setPointerCapture(event.pointerId);
  };
  const onPortPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, node: FlowNode, handle: string) => {
    event.stopPropagation();
    event.preventDefault();
    const point = toWorld(event.clientX, event.clientY);
    gesture.current = { kind: "connect", source: node.id, handle };
    setConnecting({ source: node.id, handle, ...point, target: null });
    setDropMenu(null);
    canvasRef.current?.setPointerCapture(event.pointerId);
  };
  const onCanvasPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current) return;
    if (current.kind === "connect") {
      const point = toWorld(event.clientX, event.clientY);
      const target = magnetTarget(point, current.source);
      setConnecting(value => value ? { ...value, ...point, target } : value);
      return;
    }
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (!current.moved && Math.hypot(dx, dy) < 3) return;
    current.moved = true;
    if (current.kind === "pan") setView(value => ({ ...value, x: current.originX + dx, y: current.originY + dy }));
    else {
      const k = viewRef.current.k;
      setState(value => ({
        ...value,
        flow: { ...value.flow, nodes: value.flow.nodes.map(node => node.id === current.id ? { ...node, position: { x: Math.round(current.originX + dx / k), y: Math.round(current.originY + dy / k) } } : node) },
      }));
    }
  };
  const onCanvasPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    gesture.current = null;
    canvasRef.current?.releasePointerCapture?.(event.pointerId);
    if (!current) return;
    if (current.kind === "pan" && !current.moved) { setSelected(null); setSelectedEdge(null); }
    if (current.kind !== "connect") return;
    setConnecting(null);
    const element = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    const targetId = magnetTarget(toWorld(event.clientX, event.clientY), current.source)
      ?? element?.closest<HTMLElement>("[data-node-id]")?.dataset.nodeId;
    if (targetId && targetId !== current.source && targetId !== FLOW_TRIGGER_ID) {
      setFlow(value => connectNodes(value, current.source, current.handle, targetId));
      return;
    }
    if (!targetId) {
      const rect = canvasRef.current?.getBoundingClientRect();
      const point = toWorld(event.clientX, event.clientY);
      // Keep the menu (≈ 220 × 290) inside the canvas.
      const usable = canvasRef.current ? visibleCanvasWidth(canvasRef.current) : rect?.width ?? 0;
      const screenX = Math.max(8, Math.min(event.clientX - (rect?.left ?? 0), usable - 236));
      const screenY = Math.max(8, Math.min(event.clientY - (rect?.top ?? 0), (rect?.height ?? 0) - 296));
      setDropMenu({ source: current.source, handle: current.handle, x: point.x, y: point.y - PLAIN_NODE_H / 2, screenX, screenY });
    }
  };

  const selectedNode = flow.nodes.find(node => node.id === selected) ?? null;
  const selectedPipeline = (id: string | null | undefined) => pipelines.find(item => item.id === id);
  const scopedPosts = state.triggerType === "comment" && state.postScope === "specific";
  const triggerWhere = scopedPosts
    ? ` em ${state.mediaIds.length || "?"} ${state.mediaIds.length === 1 ? "post" : "posts"}`
    : state.triggerType === "comment" ? " em todos os posts" : "";
  const triggerSummary = state.matchType === "any"
    ? `${TRIGGER_SHORT[state.triggerType]}${triggerWhere} com qualquer texto`
    : `${TRIGGER_SHORT[state.triggerType]}${triggerWhere}: ${keywordList(state.keywords).join(", ") || "defina as palavras"}`;

  const save = () => {
    if (blocking.length || saving) return;
    onSave(state);
  };
  const dirty = useMemo(() => JSON.stringify(state) !== JSON.stringify(initial), [initial, state]);
  const requestClose = () => {
    if (saving) return;
    if (dirty && !window.confirm("Descartar as alterações deste fluxo?")) return;
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={value => { if (!value) requestClose(); }}>
      <DialogContent className="ig-studio-composer ig-flow-dialog" overlayClassName="ig-studio-overlay" showCloseButton={false}>
        <header className="ig-flow-topbar">
          <div className="ig-flow-title">
            <span className="ig-eyebrow">{editing ? "EDITAR FLUXO" : "NOVO FLUXO"}</span>
            <DialogTitle className="sr-only">{state.name || "Automação sem nome"}</DialogTitle>
            <input
              aria-label="Nome da automação" value={state.name} maxLength={120}
              placeholder="Dê um nome à automação"
              onChange={event => setState(value => ({ ...value, name: event.target.value }))}
            />
          </div>
          <div className="ig-flow-controls">
            {connections.length > 1 && (
              <select aria-label="Conta profissional" value={state.connectionId} onChange={event => setState(value => ({ ...value, connectionId: event.target.value, mediaIds: event.target.value === value.connectionId ? value.mediaIds : [] }))}>
                {connections.map(item => <option key={item.id} value={item.id}>@{item.username}</option>)}
              </select>
            )}
            <div className="ig-flow-segmented" role="radiogroup" aria-label="Status">
              {(["draft", "active", "paused"] as const).map(status => (
                <button key={status} type="button" role="radio" aria-checked={state.status === status} onClick={() => setState(value => ({ ...value, status }))}>
                  {status === "active" && <span className="ig-dot is-active" />}
                  {status === "draft" ? "Rascunho" : status === "active" ? "Ativa" : "Pausada"}
                </button>
              ))}
            </div>
            <button type="button" className="ig-btn" onClick={requestClose} disabled={saving}>Cancelar</button>
            <button type="button" className="ig-btn ig-primary" onClick={save} disabled={saving || blocking.length > 0} title={blocking[0]?.message}>
              <Workflow size={15} />{saving ? "Salvando…" : state.status === "active" ? "Salvar e ativar" : "Salvar"}
            </button>
          </div>
        </header>

        <div className="ig-flow-body">
          <div
            ref={attachCanvas}
            className={`ig-flow-canvas${connecting ? " is-connecting" : ""}`}
            style={{ backgroundSize: `${22 * view.k}px ${22 * view.k}px`, backgroundPosition: `${view.x}px ${view.y}px` }}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={onCanvasPointerUp}
            onPointerCancel={onCanvasPointerUp}
          >
            <div className="ig-flow-world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
              <svg className="ig-flow-edges" width="1" height="1" aria-hidden="true">
                {flow.edges.map(edge => {
                  const source = flow.nodes.find(node => node.id === edge.source);
                  const target = flow.nodes.find(node => node.id === edge.target);
                  if (!source || !target) return null;
                  const index = nodeOutputs(source).findIndex(output => output.handle === edge.sourceHandle);
                  if (index < 0) return null;
                  const path = curve(outPort(source, index), inPort(target));
                  const active = edge.id === selectedEdge || edge.source === selected || edge.target === selected;
                  return (
                    <g key={edge.id} className={`ig-flow-edge${active ? " is-active" : ""}${edge.sourceHandle === "timeout" || edge.sourceHandle === "no" ? " is-muted" : ""}`}>
                      <path d={path.d} className="ig-flow-edge-hit" onPointerDown={event => { event.stopPropagation(); setSelectedEdge(edge.id); setSelected(null); }} />
                      <path d={path.d} className="ig-flow-edge-line" markerEnd="url(#ig-flow-arrow)" />
                    </g>
                  );
                })}
                {connecting && (() => {
                  const source = flow.nodes.find(node => node.id === connecting.source);
                  if (!source) return null;
                  const index = nodeOutputs(source).findIndex(output => output.handle === connecting.handle);
                  const snapped = connecting.target ? flow.nodes.find(node => node.id === connecting.target) : null;
                  return <path d={curve(outPort(source, Math.max(0, index)), snapped ? inPort(snapped) : connecting).d} className={`ig-flow-edge-draft${snapped ? " is-snapped" : ""}`} />;
                })()}
                <defs>
                  <marker id="ig-flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M 0 1 L 9 5 L 0 9 z" />
                  </marker>
                </defs>
              </svg>

              {selectedEdge && (() => {
                const edge = flow.edges.find(item => item.id === selectedEdge);
                const source = edge && flow.nodes.find(node => node.id === edge.source);
                const target = edge && flow.nodes.find(node => node.id === edge.target);
                if (!edge || !source || !target) return null;
                const index = nodeOutputs(source).findIndex(output => output.handle === edge.sourceHandle);
                const { mid } = curve(outPort(source, index), inPort(target));
                return (
                  <button type="button" className="ig-flow-edge-remove ig-flow-floating" style={{ left: mid.x, top: mid.y }} aria-label="Remover ligação"
                    onPointerDown={event => event.stopPropagation()} onClick={removeSelected}>
                    <X size={12} />
                  </button>
                );
              })()}

              {flow.nodes.map(node => {
                const Icon = nodeIcon(node);
                if (node.type === "delay") {
                  const delayIssues = issuesByNode.get(node.id) ?? [];
                  const connected = Boolean(nextNodeId(flow, node.id, "next"));
                  return (
                    <div
                      key={node.id}
                      data-node-id={node.id}
                      className={`ig-flow-node is-delay is-compact${selected === node.id ? " is-selected" : ""}${connecting?.target === node.id ? " is-drop-target" : ""}${delayIssues.some(issue => issue.level === "error") ? " has-error" : delayIssues.length ? " has-warning" : ""}`}
                      style={{ left: node.position.x, top: node.position.y, width: DELAY_D, height: DELAY_D }}
                      onPointerDown={event => onNodePointerDown(event, node)}
                      title={`Atraso de ${formatSeconds(node.data.seconds)}`}
                    >
                      <span className="ig-flow-node-glow" aria-hidden="true" />
                      <span className="ig-flow-port is-in" aria-hidden="true" />
                      <Timer size={22} className="ig-flow-delay-icon" />
                      <small className="ig-flow-delay-label">{formatSeconds(node.data.seconds)}{node.data.typing && node.data.seconds <= FLOW_INLINE_DELAY_SECONDS ? " · digitando" : ""}</small>
                      <button
                        type="button"
                        className={`ig-flow-port is-out${connected ? " is-connected" : ""}`}
                        aria-label="Ligar a saída do atraso"
                        onPointerDown={event => onPortPointerDown(event, node, "next")}
                      />
                    </div>
                  );
                }
                const outputs = nodeOutputs(node);
                const nodeIssues = issuesByNode.get(node.id) ?? [];
                const hasError = nodeIssues.some(issue => issue.level === "error");
                const hasWarning = !hasError && nodeIssues.length > 0;
                const links = node.type === "message" ? node.data.buttons.filter(button => button.kind === "url").length : 0;
                const badge = node.type === "trigger" ? "Início"
                  : privateReplies.has(node.id) ? "Resposta privada"
                  : links ? `${links} link${links > 1 ? "s" : ""}` : null;
                return (
                  <div
                    key={node.id}
                    data-node-id={node.id}
                    className={`ig-flow-node is-${node.type === "action" ? `action-${node.data.kind}` : node.type}${selected === node.id ? " is-selected" : ""}${connecting?.target === node.id ? " is-drop-target" : ""}${hasError ? " has-error" : hasWarning ? " has-warning" : ""}`}
                    style={{ left: node.position.x, top: node.position.y, width: NODE_W, height: nodeHeight(node) }}
                    onPointerDown={event => onNodePointerDown(event, node)}
                  >
                    <span className="ig-flow-node-glow" aria-hidden="true" />
                    {node.type !== "trigger" && <span className="ig-flow-port is-in" aria-hidden="true" />}
                    <header style={{ height: HEADER_H }}>
                      <span className="ig-flow-node-icon"><Icon size={14} /></span>
                      <b>{nodeTitle(node)}</b>
                      {badge && <small>{badge}</small>}
                      {(hasError || hasWarning) && <AlertTriangle size={13} className="ig-flow-node-alert" aria-label={nodeIssues[0].message} />}
                    </header>
                    <p className={`ig-flow-node-body${node.type === "trigger" && scopedPosts && state.mediaIds.length ? " has-posts" : ""}`} style={{ height: BODY_H }}>
                      {node.type === "trigger" && scopedPosts && state.mediaIds.length > 0 && <PostStack connectionId={state.connectionId} ids={state.mediaIds} size={26} max={4} />}
                      <span>{node.type === "trigger" ? triggerSummary : describeNode(node)}</span>
                    </p>
                    {hasSingleNext(node) ? (
                      <button
                        type="button"
                        className={`ig-flow-port is-out is-mid${nextNodeId(flow, node.id, "next") ? " is-connected" : ""}`}
                        aria-label="Ligar a saída Em seguida"
                        title="Em seguida"
                        onPointerDown={event => onPortPointerDown(event, node, "next")}
                      />
                    ) : <ul className="ig-flow-node-outputs">
                      {outputs.map(output => {
                        const connected = Boolean(nextNodeId(flow, node.id, output.handle));
                        return (
                          <li key={output.handle} style={{ height: ROW_H }} className={`is-${output.handle.startsWith("button:") ? "button" : output.handle}`}>
                            <span>{output.handle.startsWith("button:") && <MousePointerClick size={11} />}{output.label}</span>
                            <button
                              type="button"
                              className={`ig-flow-port is-out${connected ? " is-connected" : ""}`}
                              aria-label={`Ligar a saída ${output.label}`}
                              onPointerDown={event => onPortPointerDown(event, node, output.handle)}
                            />
                          </li>
                        );
                      })}
                    </ul>}
                  </div>
                );
              })}
            </div>

            <div className="ig-flow-palette ig-flow-floating" role="toolbar" aria-label="Adicionar bloco">
              {PALETTE.map(item => (
                <button key={item.type} type="button" onClick={() => addNode(item.type)} disabled={flow.nodes.length >= FLOW_MAX_NODES}
                  title={selectedNode ? `Adicionar ${item.label.toLowerCase()} depois do bloco selecionado` : `Adicionar ${item.label.toLowerCase()}`}>
                  <span className={`ig-flow-chip is-${item.type === "tag" ? "action-add_tag" : item.type === "action" ? "action-crm" : item.type}`}><item.icon size={13} /></span>
                  {item.label}
                </button>
              ))}
            </div>

            {dropMenu && (
              <div className="ig-flow-drop-menu ig-flow-floating" style={{ left: dropMenu.screenX, top: dropMenu.screenY }} onPointerDown={event => event.stopPropagation()}>
                <small>Ligar a um novo bloco</small>
                {PALETTE.map(item => (
                  <button key={item.type} type="button" onClick={() => { addNode(item.type, { x: dropMenu.x, y: dropMenu.y }, { source: dropMenu.source, handle: dropMenu.handle }); setDropMenu(null); }}>
                    <span className={`ig-flow-chip is-${item.type === "tag" ? "action-add_tag" : item.type === "action" ? "action-crm" : item.type}`}><item.icon size={12} /></span>{item.label}
                  </button>
                ))}
              </div>
            )}

            <div className="ig-flow-zoom ig-flow-floating">
              <button type="button" onClick={() => zoomAt(1 / 1.2)} aria-label="Diminuir zoom"><Minus size={14} /></button>
              <span>{Math.round(view.k * 100)}%</span>
              <button type="button" onClick={() => zoomAt(1.2)} aria-label="Aumentar zoom"><Plus size={14} /></button>
              <button type="button" onClick={() => fitView()} aria-label="Enquadrar fluxo"><Maximize2 size={13} /></button>
            </div>
            <p className="ig-flow-hint ig-flow-floating">Arraste o fundo para navegar · puxe a bolinha de uma saída até outro bloco para ligar · Ctrl + rolagem para zoom</p>
          </div>

          <aside className="ig-flow-inspector">
            {selectedNode ? (
              <NodeInspector
                key={selectedNode.id}
                node={selectedNode}
                state={state}
                issues={issuesByNode.get(selectedNode.id) ?? []}
                isPrivateReply={privateReplies.has(selectedNode.id)}
                pipelines={pipelines}
                profiles={profiles}
                selectedPipeline={selectedPipeline}
                variables={messageVariables}
                onDuplicate={duplicateSelected}
                onState={patch => setState(value => ({ ...value, ...patch }))}
                onData={data => updateData(selectedNode.id, data)}
                onRemove={() => { setFlow(current => removeFlowNode(current, selectedNode.id)); setSelected(null); }}
              />
            ) : (
              <FlowOverview issues={issues} flow={flow} triggerType={state.triggerType} onSelect={id => { setSelected(id); setSelectedEdge(null); }} />
            )}
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FlowOverview({ issues, flow, triggerType, onSelect }: { issues: FlowIssue[]; flow: AutomationFlow; triggerType: BuilderTrigger; onSelect: (id: string) => void }) {
  const errors = issues.filter(issue => issue.level === "error");
  const warnings = issues.filter(issue => issue.level === "warning");
  const messages = flow.nodes.filter(node => node.type === "message").length;
  return (
    <div className="ig-flow-panel">
      <span className="ig-eyebrow">VISÃO GERAL</span>
      <h3>{flow.nodes.length - 1} bloco{flow.nodes.length === 2 ? "" : "s"} · {messages} mensage{messages === 1 ? "m" : "ns"}</h3>
      <p className="ig-flow-muted">Selecione um bloco para editar. Use a barra do canvas para adicionar etapas; com um bloco selecionado, o novo já entra ligado a ele.</p>
      {errors.length === 0 ? (
        <div className="ig-flow-status is-ok"><CheckCircle2 size={16} /><span><b>Pronto para ativar</b><small>{warnings.length ? `${warnings.length} aviso${warnings.length > 1 ? "s" : ""} para revisar` : "Nenhuma pendência encontrada"}</small></span></div>
      ) : (
        <div className="ig-flow-status is-error"><AlertTriangle size={16} /><span><b>{errors.length} pendência{errors.length > 1 ? "s" : ""}</b><small>Você pode salvar como rascunho e terminar depois</small></span></div>
      )}
      {issues.length > 0 && (
        <ul className="ig-flow-issues">
          {issues.map((issue, index) => (
            <li key={`${issue.nodeId}-${index}`} className={`is-${issue.level}`}>
              <button type="button" disabled={!issue.nodeId} onClick={() => issue.nodeId && onSelect(issue.nodeId)}>{issue.message}</button>
            </li>
          ))}
        </ul>
      )}
      <div className="ig-flow-rules">
        <span className="ig-eyebrow">REGRAS DA META</span>
        <ul>
          {triggerType === "comment" && <li><b>Comentário = 1 resposta privada.</b> A conversa segue quando o lead toca num botão de resposta ou responde no Direct.</li>}
          <li><b>Mensagens automáticas até 24h</b> depois da última mensagem do lead.</li>
          <li><b>Leads de anúncio Click to Direct</b> ficam com a janela aberta por até 7 dias.</li>
        </ul>
      </div>
    </div>
  );
}

function NodeInspector({
  node, state, issues, isPrivateReply, pipelines, profiles, selectedPipeline, variables, onDuplicate, onState, onData, onRemove,
}: {
  node: FlowNode;
  state: BuilderState;
  issues: FlowIssue[];
  isPrivateReply: boolean;
  pipelines: BuilderPipeline[];
  profiles: BuilderProfile[];
  selectedPipeline: (id: string | null | undefined) => BuilderPipeline | undefined;
  onState: (patch: Partial<BuilderState>) => void;
  onData: (data: Record<string, unknown>) => void;
  onRemove: () => void;
  variables: Array<{ key: string; label: string }>;
  onDuplicate: () => void;
}) {
  const Icon = nodeIcon(node);
  return (
    <div className="ig-flow-panel">
      <div className="ig-flow-panel-head">
        <span className={`ig-flow-chip is-${node.type === "action" ? `action-${node.data.kind}` : node.type}`}><Icon size={14} /></span>
        <div><span className="ig-eyebrow">{node.type === "trigger" ? "INÍCIO" : "BLOCO"}</span><h3>{nodeTitle(node)}</h3></div>
        {node.type !== "trigger" && (
          <span className="ig-flow-panel-actions">
            <button type="button" className="ig-btn ig-icon-btn" onClick={onDuplicate} aria-label="Duplicar bloco" title="Duplicar (Ctrl/⌘ + D)"><Copy size={15} /></button>
            <button type="button" className="ig-btn ig-icon-btn ig-danger" onClick={onRemove} aria-label="Excluir bloco" title="Excluir (Delete)"><Trash2 size={15} /></button>
          </span>
        )}
      </div>
      {issues.length > 0 && (
        <ul className="ig-flow-issues">
          {issues.map((issue, index) => <li key={index} className={`is-${issue.level}`}><span>{issue.message}</span></li>)}
        </ul>
      )}
      {node.type === "trigger" && <TriggerFields state={state} onState={onState} />}
      {node.type === "message" && <MessageFields data={node.data} isPrivateReply={isPrivateReply} variables={variables} onData={onData} />}
      {node.type === "delay" && (
        <>
          <p className="ig-flow-muted"><b>Atraso</b> é só uma pausa: o fluxo espera o tempo e segue sozinho, sem depender do lead. Use para dar ritmo entre uma mensagem e outra.</p>
          <Field label="Pausar por"><DurationInput seconds={node.data.seconds} allowSeconds onChange={seconds => onData({ seconds })} /></Field>
          <div className="ig-flow-toggle-row">
            <span><b>Mostrar “digitando…”</b><small>Aparece para o lead durante pausas de até 1 minuto, com a conversa aberta.</small></span>
            <Switch checked={node.data.typing} label="Mostrar digitando" onChange={typing => onData({ typing })} />
          </div>
        </>
      )}
      {node.type === "wait_reply" && <WaitFields data={node.data} onData={onData} />}
      {node.type === "condition" && <ConditionFields data={node.data} onData={onData} />}
      {node.type === "action" && <ActionFields data={node.data} pipelines={pipelines} profiles={profiles} selectedPipeline={selectedPipeline} onData={onData} />}
    </div>
  );
}

function TriggerFields({ state, onState }: { state: BuilderState; onState: (patch: Partial<BuilderState>) => void }) {
  return (
    <>
      <Field label="Quando alguém">
        <select value={state.triggerType} onChange={event => {
          const triggerType = event.target.value as BuilderTrigger;
          const keepsAny = triggerType !== "comment" || state.postScope === "specific";
          onState({ triggerType, matchType: state.matchType === "any" && !keepsAny ? "contains" : state.matchType });
        }}>
          {(Object.keys(TRIGGER_LABELS) as BuilderTrigger[]).map(key => <option key={key} value={key}>{TRIGGER_LABELS[key]}</option>)}
        </select>
      </Field>
      {state.triggerType === "comment" && (
        <Field label="Posts" hint={state.postScope === "specific" ? "Só comentários nesses posts iniciam o fluxo." : "Qualquer post ou Reels, inclusive os futuros."}>
          <PostScopeField connectionId={state.connectionId} scope={state.postScope} mediaIds={state.mediaIds}
            onChange={({ scope, mediaIds }) => onState({ postScope: scope, mediaIds, ...(scope === "all" && state.matchType === "any" ? { matchType: "contains" as BuilderMatch } : {}) })} />
        </Field>
      )}
      <Field label="Correspondência">
        <select value={state.matchType} onChange={event => onState({ matchType: event.target.value as BuilderMatch })}>
          <option value="contains">Contém a palavra/frase</option>
          <option value="exact">É exatamente igual</option>
          <option value="starts_with">Começa com</option>
          {(state.triggerType !== "comment" || state.postScope === "specific") && <option value="any">{state.triggerType === "comment" ? "Qualquer comentário" : "Qualquer texto"}</option>}
        </select>
      </Field>
      {state.matchType !== "any" && (
        <Field label="Palavras ou frases" hint="Uma por linha ou separadas por vírgula. Acentos e maiúsculas não importam.">
          <textarea rows={3} value={state.keywords} onChange={event => onState({ keywords: event.target.value })} placeholder={"quero\ntabela\nlançamento"} />
        </Field>
      )}
      {state.triggerType === "comment" && (
        <>
          <Field label="Resposta pública no comentário" hint="Opcional. Aparece para todos, logo abaixo do comentário.">
            <input value={state.publicReplyText} maxLength={1000} onChange={event => onState({ publicReplyText: event.target.value })} placeholder="Te mandei no direct!" />
          </Field>
          <div className="ig-flow-callout">A primeira mensagem do fluxo sai como <b>resposta privada</b>. Coloque nela um botão de resposta para abrir a conversa e liberar as próximas mensagens.</div>
        </>
      )}
    </>
  );
}

function MessageFields({ data, isPrivateReply, variables, onData }: {
  data: MessageNodeData;
  isPrivateReply: boolean;
  variables: Array<{ key: string; label: string }>;
  onData: (data: Record<string, unknown>) => void;
}) {
  const limit = data.buttons.length ? FLOW_MAX_TEXT_WITH_BUTTONS : FLOW_MAX_TEXT;
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  // Where the cursor was in the text before a variable chip took the focus.
  const caret = useRef<{ start: number; end: number } | null>(null);
  const rememberCaret = () => {
    const element = textRef.current;
    if (element) caret.current = { start: element.selectionStart, end: element.selectionEnd };
  };
  const insertVariable = (key: string) => {
    const element = textRef.current;
    const token = `{${key}}`;
    const start = Math.min(caret.current?.start ?? data.text.length, data.text.length);
    const end = Math.min(caret.current?.end ?? data.text.length, data.text.length);
    caret.current = { start: start + token.length, end: start + token.length };
    const text = `${data.text.slice(0, start)}${token}${data.text.slice(end)}`.slice(0, FLOW_MAX_TEXT);
    onData({ text });
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(start + token.length, start + token.length);
    });
  };
  const hasReply = data.buttons.some(button => button.kind === "reply");
  const setButtons = (buttons: FlowButton[]) => onData({ buttons, timeoutMinutes: buttons.some(button => button.kind === "reply") ? data.timeoutMinutes ?? null : null });
  return (
    <>
      {isPrivateReply && <div className="ig-flow-callout">Esta é a <b>resposta privada</b> ao comentário. Para continuar a conversa depois dela, use um botão do tipo “Continua o fluxo”.</div>}
      <Field label="Texto" hint={`${data.text.length}/${limit}`}>
        <textarea ref={textRef} rows={5} value={data.text} maxLength={FLOW_MAX_TEXT} onSelect={rememberCaret} onKeyUp={rememberCaret} onClick={rememberCaret} onChange={event => { onData({ text: event.target.value }); rememberCaret(); }} placeholder="Oi {primeiro_nome}! Aqui está o material que você pediu…" />
      </Field>
      <div className="ig-flow-variables" aria-label="Inserir variável">
        {variables.map(variable => (
          <button key={variable.key} type="button" onClick={() => insertVariable(variable.key)} title={`Insere {${variable.key}}`}>+ {variable.label}</button>
        ))}
      </div>
      <p className="ig-flow-muted is-small">Se o dado não existir para o contato, a variável some do texto. O nome vem do perfil do Instagram de quem já falou com você no Direct.</p>
      <div className="ig-flow-buttons">
        <div className="ig-flow-subhead"><b>Botões</b><small>{data.buttons.length}/{FLOW_MAX_BUTTONS}</small></div>
        {data.buttons.map((button, index) => (
          <div key={button.id} className="ig-flow-button-row">
            <div className="ig-flow-segmented is-small" role="radiogroup" aria-label="Tipo do botão">
              <button type="button" role="radio" aria-checked={button.kind === "reply"} onClick={() => setButtons(data.buttons.map((item, position) => position === index ? { id: item.id, label: item.label, kind: "reply" } : item))}><MousePointerClick size={12} />Continua o fluxo</button>
              <button type="button" role="radio" aria-checked={button.kind === "url"} onClick={() => setButtons(data.buttons.map((item, position) => position === index ? { ...item, kind: "url", url: item.url ?? "" } : item))}><Link2 size={12} />Abre link</button>
            </div>
            <div className="ig-flow-button-fields">
              <input aria-label="Título do botão" value={button.label} maxLength={FLOW_MAX_BUTTON_LABEL} placeholder="Título (até 20)"
                onChange={event => setButtons(data.buttons.map((item, position) => position === index ? { ...item, label: event.target.value } : item))} />
              <button type="button" className="ig-btn ig-icon-btn" aria-label="Remover botão" onClick={() => setButtons(data.buttons.filter((_, position) => position !== index))}><Trash2 size={14} /></button>
            </div>
            {button.kind === "url" && (
              <input aria-label="Link do botão" type="url" value={button.url ?? ""} placeholder="https://seusite.com/material"
                onChange={event => setButtons(data.buttons.map((item, position) => position === index ? { ...item, url: event.target.value } : item))} />
            )}
          </div>
        ))}
        {data.buttons.length < FLOW_MAX_BUTTONS && (
          <button type="button" className="ig-text-link" onClick={() => setButtons([...data.buttons, { id: flowId("b"), kind: "reply", label: "" }])}><Plus size={13} />Adicionar botão</button>
        )}
      </div>
      {hasReply && (
        <div className="ig-flow-toggle-row">
          <span><b>Seguir outro caminho se não tocar</b><small>Cria a saída “Não tocou”.</small></span>
          <Switch checked={Boolean(data.timeoutMinutes)} label="Seguir outro caminho se não tocar" onChange={checked => onData({ timeoutMinutes: checked ? 120 : null })} />
        </div>
      )}
      {hasReply && data.timeoutMinutes ? <Field label="Esperar o toque por até"><DurationInput seconds={data.timeoutMinutes * 60} onChange={seconds => onData({ timeoutMinutes: Math.max(1, Math.round(seconds / 60)) })} /></Field> : null}
    </>
  );
}

function ConditionFields({ data, onData }: { data: ConditionNodeData; onData: (data: Record<string, unknown>) => void }) {
  return (
    <>
      <Field label="Verificar se">
        <select value={data.kind} onChange={event => onData({ kind: event.target.value, value: event.target.value === "from_ad" ? "" : data.value })}>
          <option value="reply_contains">A última resposta contém</option>
          <option value="has_tag">O contato tem a tag</option>
          <option value="from_ad">O lead veio de um anúncio</option>
        </select>
      </Field>
      {data.kind !== "from_ad" && (
        <Field label={data.kind === "has_tag" ? "Tag" : "Texto"} hint="Separe alternativas por vírgula: basta uma bater.">
          <input value={data.value} maxLength={120} onChange={event => onData({ value: event.target.value })} placeholder={data.kind === "has_tag" ? "quente" : "sim, quero, 1 mi"} />
        </Field>
      )}
      <p className="ig-flow-muted">Quando bate, segue por <b>Sim</b>; caso contrário, por <b>Não</b>.</p>
    </>
  );
}

function ActionFields({ data, pipelines, profiles, selectedPipeline, onData }: {
  data: ActionNodeData;
  pipelines: BuilderPipeline[];
  profiles: BuilderProfile[];
  selectedPipeline: (id: string | null | undefined) => BuilderPipeline | undefined;
  onData: (data: Record<string, unknown>) => void;
}) {
  const crm = data.crm ?? { pipelineId: null, stageId: null, originId: null, assignedTo: null, dealValue: 0 };
  const stages = (selectedPipeline(crm.pipelineId)?.crm_stages ?? []).filter(stage => stage.is_active).sort((a, b) => a.order_index - b.order_index);
  const setCrm = (patch: Partial<typeof crm>) => onData({ crm: { ...crm, ...patch } });
  return (
    <>
      <div className="ig-flow-segmented is-wide" role="radiogroup" aria-label="Tipo de ação">
        <button type="button" role="radio" aria-checked={data.kind === "crm"} onClick={() => onData({ kind: "crm", crm })}><Target size={13} />Oportunidade no CRM</button>
        <button type="button" role="radio" aria-checked={data.kind === "add_tag"} onClick={() => onData({ kind: "add_tag", tag: data.tag ?? "" })}><Tag size={13} />Adicionar tag</button>
      </div>
      {data.kind === "add_tag" ? (
        <Field label="Tag" hint="Use em condições mais adiante no fluxo ou em outras automações.">
          <input value={data.tag ?? ""} maxLength={40} onChange={event => onData({ tag: event.target.value })} placeholder="quente" />
        </Field>
      ) : (
        <>
          <Field label="Pipeline">
            <select value={crm.pipelineId ?? ""} onChange={event => setCrm({ pipelineId: event.target.value || null, stageId: null })}>
              <option value="">Selecione</option>
              {pipelines.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="Etapa inicial">
            <select value={crm.stageId ?? ""} onChange={event => setCrm({ stageId: event.target.value || null })} disabled={!crm.pipelineId}>
              <option value="">Selecione</option>
              {stages.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="Origem"><LeadOriginSelector value={crm.originId} onChange={originId => setCrm({ originId: originId ?? null })} placeholder="Selecione ou crie" /></Field>
          <Field label="Responsável">
            <select value={crm.assignedTo ?? ""} onChange={event => setCrm({ assignedTo: event.target.value || null })}>
              <option value="">Sem responsável</option>
              {profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.full_name}{profile.job_title ? ` — ${profile.job_title}` : ""}</option>)}
            </select>
          </Field>
          <Field label="Valor do negócio (R$)">
            <input type="number" min={0} step="0.01" value={crm.dealValue} onChange={event => setCrm({ dealValue: Math.max(0, Number(event.target.value) || 0) })} />
          </Field>
          <p className="ig-flow-muted">Se o contato já tiver uma oportunidade criada por automação, ela é reaproveitada.</p>
        </>
      )}
    </>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="ig-flow-field"><span>{label}{hint && <small>{hint}</small>}</span>{children}</label>;
}

function Switch({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className="ig-flow-switch">
      <span />
    </button>
  );
}

const SAVE_OPTIONS: Array<{ value: CollectedFieldKind | ""; label: string }> = [
  { value: "", label: "Não salvar" },
  { value: "name", label: FLOW_FIELD_LABELS.name },
  { value: "phone", label: FLOW_FIELD_LABELS.phone },
  { value: "email", label: FLOW_FIELD_LABELS.email },
  { value: "custom", label: "Outro campo…" },
];

function WaitFields({ data, onData }: { data: WaitReplyNodeData; onData: (data: Record<string, unknown>) => void }) {
  const variable = data.saveAs === "custom" ? (data.fieldLabel ? fieldSlug(data.fieldLabel) : "") : data.saveAs === "phone" ? "whatsapp" : data.saveAs === "email" ? "email" : data.saveAs === "name" ? "nome" : "";
  return (
    <>
      <p className="ig-flow-muted"><b>Aguardar resposta</b> para o fluxo até o lead escrever no Direct. Se ele responder, segue por <b>Respondeu</b>; se o tempo acabar sem resposta, segue por <b>Sem resposta</b>. É diferente do Atraso, que só pausa e segue sozinho.</p>
      <Field label="Esperar a resposta por até"><DurationInput seconds={data.timeoutMinutes * 60} onChange={seconds => onData({ timeoutMinutes: Math.max(1, Math.round(seconds / 60)) })} /></Field>
      <Field label="Salvar a resposta como" hint="Coleta de dados">
        <select value={data.saveAs ?? ""} onChange={event => onData({ saveAs: event.target.value || null, ...(event.target.value === "custom" ? {} : { fieldLabel: undefined }) })}>
          {SAVE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </Field>
      {data.saveAs === "custom" && (
        <Field label="Nome do campo">
          <input value={data.fieldLabel ?? ""} maxLength={40} onChange={event => onData({ fieldLabel: event.target.value })} placeholder="Ex.: Cidade, Orçamento, Bairro" />
        </Field>
      )}
      {data.saveAs && (
        <div className="ig-flow-callout is-data">
          {variable ? <>Use <code>{`{${variable}}`}</code> nas próximas mensagens. </> : null}
          {data.saveAs === "phone" || data.saveAs === "email"
            ? <>Se a resposta não parecer um {data.saveAs === "phone" ? "WhatsApp (DDD + número)" : "e-mail"}, o fluxo segue por <b>Resposta inválida</b>; ligue essa saída a uma mensagem pedindo de novo.</>
            : null}
          {" "}No bloco <b>CRM</b>, nome, WhatsApp e e-mail vão para os campos do lead; os outros campos entram nas observações.
        </div>
      )}
    </>
  );
}

const UNITS = [
  { id: "s", label: "segundos", factor: 1 },
  { id: "m", label: "minutos", factor: 60 },
  { id: "h", label: "horas", factor: 3600 },
  { id: "d", label: "dias", factor: 86400 },
] as const;
type UnitId = (typeof UNITS)[number]["id"];

/** Duration in seconds, shown in the most natural unit. allowSeconds enables the "segundos" unit. */
function DurationInput({ seconds, allowSeconds = false, onChange }: { seconds: number; allowSeconds?: boolean; onChange: (seconds: number) => void }) {
  const units = UNITS.filter(unit => allowSeconds || unit.id !== "s");
  const [unit, setUnit] = useState<UnitId>(() => {
    if (seconds >= 86400 && seconds % 86400 === 0) return "d";
    if (seconds >= 3600 && seconds % 3600 === 0) return "h";
    if (!allowSeconds || (seconds >= 60 && seconds % 60 === 0)) return "m";
    return "s";
  });
  const factor = UNITS.find(item => item.id === unit)!.factor;
  const value = Math.round((seconds / factor) * 100) / 100;
  const minimum = allowSeconds ? 1 : 60;
  return (
    <span className="ig-flow-duration">
      <input type="number" min={unit === "s" ? 1 : 0.5} step={unit === "s" || unit === "m" ? 1 : 0.5} value={value} aria-label="Duração"
        onChange={event => onChange(Math.max(minimum, Math.min(604_800, Math.round((Number(event.target.value) || 0) * factor))))} />
      <select value={unit} aria-label="Unidade" onChange={event => setUnit(event.target.value as UnitId)}>
        {units.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </span>
  );
}
