"use client";

import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { BaseNode, NodeField, NodeSelect } from "../BaseNode";
import { useWorkflowStore } from "@/store/workflow";
import type { CopyGeneratorNodeData } from "@/lib/workflow/types";

const MODEL_OPTIONS = [
  { value: "anthropic", label: "Claude (Anthropic)" },
  { value: "openai",    label: "GPT-4o (OpenAI)" },
  { value: "gemini",    label: "Gemini (Google)" },
];

export const CopyGeneratorNode = memo(function CopyGeneratorNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const d = data as CopyGeneratorNodeData;

  return (
    <BaseNode id={id} type="copy-generator" selected={selected} minWidth={220}>
      <NodeField label="MODELO">
        <NodeSelect
          value={d.model ?? "anthropic"}
          onChange={(v) => updateNodeData(id, { model: v })}
          options={MODEL_OPTIONS}
        />
      </NodeField>
      <NodeField label="VARIAÇÕES">
        <div className="flex items-center gap-2">
          <input
            type="range" min={1} max={10} step={1}
            value={d.variations ?? 3}
            onChange={e => updateNodeData(id, { variations: Number(e.target.value) })}
            className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: "#8B5CF6" }}
          />
          <span className="text-xs w-4 text-center shrink-0" style={{ color: "rgba(255,255,255,0.7)" }}>
            {d.variations ?? 3}
          </span>
        </div>
      </NodeField>
    </BaseNode>
  );
});
