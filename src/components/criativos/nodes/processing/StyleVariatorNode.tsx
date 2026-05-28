"use client";

import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { BaseNode, NodeField } from "../BaseNode";
import { useWorkflowStore } from "@/store/workflow";
import type { StyleVariatorNodeData } from "@/lib/workflow/types";

const AVAILABLE_STYLES = ["luxury", "minimal", "bold", "dark", "colorful", "modern"];

export const StyleVariatorNode = memo(function StyleVariatorNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const d = data as StyleVariatorNodeData;
  const selected_styles: string[] = d.styles ?? ["luxury", "minimal", "bold"];

  const toggle = (style: string) => {
    const next = selected_styles.includes(style)
      ? selected_styles.filter(s => s !== style)
      : [...selected_styles, style];
    updateNodeData(id, { styles: next });
  };

  return (
    <BaseNode id={id} type="style-variator" selected={selected} minWidth={210}>
      <NodeField label="ESTILOS ATIVOS">
        <div className="flex flex-wrap gap-1">
          {AVAILABLE_STYLES.map(s => (
            <button
              key={s}
              onClick={() => toggle(s)}
              className="text-xs px-2 py-0.5 rounded-full transition-all capitalize"
              style={{
                background: selected_styles.includes(s) ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${selected_styles.includes(s) ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.08)"}`,
                color: selected_styles.includes(s) ? "#FCD34D" : "rgba(255,255,255,0.4)",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </NodeField>
    </BaseNode>
  );
});
