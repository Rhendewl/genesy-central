"use client";

import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { BaseNode, NodeField } from "../BaseNode";
import { useWorkflowStore } from "@/store/workflow";
import type { LayoutVariatorNodeData } from "@/lib/workflow/types";

const LAYOUT_OPTIONS = [
  { value: "centered",     label: "Central" },
  { value: "left-aligned", label: "Esquerda" },
  { value: "split",        label: "Split" },
  { value: "overlay",      label: "Overlay" },
] as const;

export const LayoutVariatorNode = memo(function LayoutVariatorNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const d = data as LayoutVariatorNodeData;
  const active: string[] = d.layouts ?? ["centered", "split"];

  const toggle = (v: string) => {
    const next = active.includes(v) ? active.filter(l => l !== v) : [...active, v];
    updateNodeData(id, { layouts: next });
  };

  return (
    <BaseNode id={id} type="layout-variator" selected={selected} minWidth={210}>
      <NodeField label="LAYOUTS ATIVOS">
        <div className="flex flex-wrap gap-1">
          {LAYOUT_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => toggle(value)}
              className="text-xs px-2 py-0.5 rounded-full transition-all"
              style={{
                background: active.includes(value) ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${active.includes(value) ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.08)"}`,
                color: active.includes(value) ? "#C4B5FD" : "rgba(255,255,255,0.4)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </NodeField>
    </BaseNode>
  );
});
