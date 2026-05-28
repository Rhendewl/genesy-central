"use client";

import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { BaseNode, NodeField, NodeSelect } from "../BaseNode";
import { useWorkflowStore } from "@/store/workflow";
import type { VisualGeneratorNodeData } from "@/lib/workflow/types";

const FORMAT_OPTIONS = [
  { value: "1080x1080", label: "Feed (1080×1080)" },
  { value: "1080x1920", label: "Stories (1080×1920)" },
  { value: "1200x628",  label: "Banner (1200×628)" },
  { value: "1920x1080", label: "Landscape (1920×1080)" },
];

const STYLE_OPTIONS = [
  { value: "photorealistic", label: "Fotorrealista" },
  { value: "illustration",   label: "Ilustração" },
  { value: "abstract",       label: "Abstrato" },
  { value: "minimal",        label: "Minimalista" },
];

export const VisualGeneratorNode = memo(function VisualGeneratorNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const d = data as VisualGeneratorNodeData;

  return (
    <BaseNode id={id} type="visual-generator" selected={selected} minWidth={220}>
      <NodeField label="FORMATO">
        <NodeSelect
          value={d.format ?? "1080x1080"}
          onChange={(v) => updateNodeData(id, { format: v })}
          options={FORMAT_OPTIONS}
        />
      </NodeField>
      <NodeField label="ESTILO VISUAL">
        <NodeSelect
          value={d.style ?? "photorealistic"}
          onChange={(v) => updateNodeData(id, { style: v })}
          options={STYLE_OPTIONS}
        />
      </NodeField>
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)", fontSize: 10 }}>
          DALL-E 3 · OpenAI
        </span>
        <span
          className="text-xs px-1.5 py-0.5 rounded"
          style={{ background: "rgba(139,92,246,0.15)", color: "#C4B5FD", fontSize: 10 }}
        >
          {d.quality === "hd" ? "HD" : "Standard"}
        </span>
      </div>
    </BaseNode>
  );
});
