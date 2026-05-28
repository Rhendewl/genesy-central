import type { Node, Edge } from "@xyflow/react";

// ── 4 tipos de node ───────────────────────────────────────────────────────────

export type WorkflowNodeType = "text" | "media" | "engine" | "result";

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
