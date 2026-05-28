"use client";

import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { Eye } from "lucide-react";
import { BaseNode, NodeField, NodeSelect } from "../BaseNode";
import { useWorkflowStore } from "@/store/workflow";
import type { PreviewNodeData } from "@/lib/workflow/types";

const FORMAT_OPTIONS = [
  { value: "1080x1080", label: "Feed (1:1)" },
  { value: "1080x1920", label: "Stories (9:16)" },
  { value: "1200x628",  label: "Banner" },
];

export const PreviewNode = memo(function PreviewNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const d = data as PreviewNodeData;

  return (
    <BaseNode id={id} type="preview" selected={selected} minWidth={200}>
      <NodeField label="FORMATO">
        <NodeSelect
          value={d.format ?? "1080x1080"}
          onChange={v => updateNodeData(id, { format: v })}
          options={FORMAT_OPTIONS}
        />
      </NodeField>
      <div className="flex items-center gap-3">
        {[
          { key: "show_copy", label: "Copy" },
          { key: "show_cta",  label: "CTA" },
        ].map(({ key, label }) => (
          <label key={key} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={!!(d as Record<string, unknown>)[key]}
              onChange={e => updateNodeData(id, { [key]: e.target.checked })}
              className="w-3 h-3 rounded"
              style={{ accentColor: "#10B981" }}
            />
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)", fontSize: 10 }}>{label}</span>
          </label>
        ))}
      </div>
      {/* Placeholder de preview */}
      <div className="rounded-md flex items-center justify-center"
        style={{
          background: "rgba(16,185,129,0.05)",
          border: "1px dashed rgba(16,185,129,0.2)",
          aspectRatio: d.format === "1080x1920" ? "9/16" : d.format === "1200x628" ? "1200/628" : "1/1",
          minHeight: 60,
        }}>
        <div className="flex flex-col items-center gap-1">
          <Eye size={16} style={{ color: "rgba(16,185,129,0.4)" }} />
          <span style={{ color: "rgba(16,185,129,0.4)", fontSize: 9 }}>Preview aqui</span>
        </div>
      </div>
    </BaseNode>
  );
});
