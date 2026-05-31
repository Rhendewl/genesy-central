import type { Node, Edge } from "@xyflow/react";

// ── 4 tipos de node ───────────────────────────────────────────────────────────

export type WorkflowNodeType = "text" | "media" | "engine" | "result";

// ── Aspect ratios ──────────────────────────────────────────────────────────────

export type AspectRatio = "1:1" | "4:5" | "9:16" | "16:9" | "3:2";

export interface AspectRatioFormat {
  ratio: AspectRatio;
  label: string;
  sub: string;
  /** Size enviado para gpt-image-1 (suporta apenas 3 valores) */
  openaiSize: "1024x1024" | "1024x1536" | "1536x1024";
  /** Instrução semântica injetada no prompt para guiar composição */
  promptHint: string;
  /** Dimensões visuais do preview retangular (dentro de bounding box 28×20) */
  vw: number;
  vh: number;
}

export const ASPECT_RATIO_FORMATS: AspectRatioFormat[] = [
  {
    ratio: "1:1",
    label: "Feed",
    sub: "1:1",
    openaiSize: "1024x1024",
    promptHint: "Gerar em formato quadrado 1:1, otimizado para Instagram Feed.",
    vw: 20, vh: 20,
  },
  {
    ratio: "4:5",
    label: "Retrato",
    sub: "4:5",
    openaiSize: "1024x1536",
    promptHint: "Gerar em formato retrato 4:5, otimizado para Instagram Feed retrato. Composição vertical com sujeito centralizado.",
    vw: 16, vh: 20,
  },
  {
    ratio: "9:16",
    label: "Story",
    sub: "9:16",
    openaiSize: "1024x1536",
    promptHint: "Gerar em formato vertical 9:16, otimizado para Instagram Stories e Reels. Layout totalmente vertical, imersivo.",
    vw: 11, vh: 20,
  },
  {
    ratio: "16:9",
    label: "Horizontal",
    sub: "16:9",
    openaiSize: "1536x1024",
    promptHint: "Gerar em formato horizontal 16:9, ideal para YouTube Thumbnails, banners e apresentações.",
    vw: 28, vh: 16,
  },
  {
    ratio: "3:2",
    label: "Paisagem",
    sub: "3:2",
    openaiSize: "1536x1024",
    promptHint: "Gerar em formato paisagem 3:2, ideal para fotografia e posts Facebook.",
    vw: 28, vh: 19,
  },
];

export type NodeExecutionStatus = "idle" | "running" | "success" | "error";

// ── Data por tipo ─────────────────────────────────────────────────────────────

export interface TextNodeData extends Record<string, unknown> {
  label: string;
  content: string;
  executionStatus?: NodeExecutionStatus;
}

export interface MediaNodeData extends Record<string, unknown> {
  label: string;
  mediaType: "logo" | "fachada" | "produto" | "fundo" | "pessoa";
  fileUrl: string | null;
  executionStatus?: NodeExecutionStatus;
}

export interface EngineNodeData extends Record<string, unknown> {
  provider: "anthropic" | "openai" | "gemini";
  mode: "copy" | "image" | "both";
  executionStatus?: NodeExecutionStatus;
  executionOutput?: Record<string, unknown>;
  executionError?: string;
}

export interface ResultNodeData extends Record<string, unknown> {
  aspectRatio?: AspectRatio;
  executionStatus?: NodeExecutionStatus;
  executionOutput?: Record<string, unknown>;
}

export type WorkflowNodeData =
  | TextNodeData
  | MediaNodeData
  | EngineNodeData
  | ResultNodeData;

// ── React Flow types ──────────────────────────────────────────────────────────

export type WorkflowNode = Node<WorkflowNodeData, WorkflowNodeType>;
export type WorkflowEdge = Edge;

// ── Serialization (stored in DB) ──────────────────────────────────────────────

export interface WorkflowNodeJSON {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface WorkflowEdgeJSON {
  id: string;
  source: string;
  target: string;
  sourceHandle: string | null;
  targetHandle: string | null;
}

export interface WorkflowJSON {
  version: "1.0";
  nodes: WorkflowNodeJSON[];
  edges: WorkflowEdgeJSON[];
}

export function serializeWorkflow(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowJSON {
  return {
    version: "1.0",
    nodes: nodes.map(n => ({
      id: n.id,
      type: n.type as WorkflowNodeType,
      position: n.position,
      data: { ...(n.data as Record<string, unknown>) },
    })),
    edges: edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
    })),
  };
}

export function deserializeWorkflow(json: WorkflowJSON): {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
} {
  const VALID_TYPES: WorkflowNodeType[] = ["text", "media", "engine", "result"];
  return {
    nodes: json.nodes
      .filter(n => VALID_TYPES.includes(n.type))
      .map(n => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data as WorkflowNodeData,
      })),
    edges: json.edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
    })),
  };
}
