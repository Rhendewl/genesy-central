"use client";

import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { BaseNode, NodeField, NodeSelect } from "../BaseNode";
import { useWorkflowStore } from "@/store/workflow";
import type { ExportNodeData } from "@/lib/workflow/types";

const FORMAT_OPTIONS = [
  { value: "png",  label: "PNG (sem perda)" },
  { value: "jpg",  label: "JPG (comprimido)" },
  { value: "webp", label: "WebP (moderno)" },
];

export const ExportNode = memo(function ExportNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const d = data as ExportNodeData;

  return (
    <BaseNode id={id} type="export" selected={selected} minWidth={200}>
      <NodeField label="FORMATO">
        <NodeSelect
          value={d.format ?? "png"}
          onChange={v => updateNodeData(id, { format: v })}
          options={FORMAT_OPTIONS}
        />
      </NodeField>
      {d.format !== "png" && (
        <NodeField label={`QUALIDADE: ${d.quality ?? 90}%`}>
          <input
            type="range" min={50} max={100} step={5}
            value={d.quality ?? 90}
            onChange={e => updateNodeData(id, { quality: Number(e.target.value) })}
            className="w-full h-1 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: "#10B981" }}
          />
        </NodeField>
      )}
    </BaseNode>
  );
});
