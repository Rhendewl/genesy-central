import type { WorkflowNodeType } from "@/lib/workflow/types";

export const DEFAULT_NODE_DATA: Record<WorkflowNodeType, Record<string, unknown>> = {
  text:   { label: "Texto",  content: "" },
  media:  { label: "Imagem", mediaType: "logo", fileUrl: null },
  engine: { provider: "openai", mode: "image" },
  result: { aspectRatio: "1:1" },
};

export const STARTER_WORKFLOW = {
  nodes: [
    {
      id: "s-text",
      type: "text" as WorkflowNodeType,
      position: { x: 80, y: 200 },
      data: { label: "Prompt", content: "" },
    },
    {
      id: "s-engine",
      type: "engine" as WorkflowNodeType,
      position: { x: 380, y: 185 },
      data: { provider: "openai", mode: "image" },
    },
    {
      id: "s-result",
      type: "result" as WorkflowNodeType,
      position: { x: 680, y: 200 },
      data: { aspectRatio: "1:1" },
    },
  ],
  edges: [
    {
      id: "s-e1",
      source: "s-text",
      target: "s-engine",
      animated: true,
      type: "smoothstep",
      style: { stroke: "rgba(139,92,246,0.65)", strokeWidth: 1.5 },
    },
    {
      id: "s-e2",
      source: "s-engine",
      target: "s-result",
      animated: true,
      type: "smoothstep",
      style: { stroke: "rgba(139,92,246,0.65)", strokeWidth: 1.5 },
    },
  ],
};
