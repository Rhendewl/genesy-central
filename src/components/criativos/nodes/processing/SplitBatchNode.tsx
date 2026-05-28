"use client";

import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { BaseNode, NodeField } from "../BaseNode";
import { useWorkflowStore } from "@/store/workflow";
import type { SplitBatchNodeData } from "@/lib/workflow/types";

export const SplitBatchNode = memo(function SplitBatchNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const d = data as SplitBatchNodeData;

  return (
    <BaseNode id={id} type="split-batch" selected={selected} minWidth={200}>
      <NodeField label="QUANTIDADE DE SAÍDAS">
        <div className="flex items-center gap-2">
          <input
            type="range" min={2} max={8} step={1}
            value={d.quantity ?? 3}
            onChange={e => updateNodeData(id, { quantity: Number(e.target.value) })}
            className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: "#F59E0B" }}
          />
          <span className="text-xs w-4 text-center shrink-0" style={{ color: "rgba(255,255,255,0.7)" }}>
            {d.quantity ?? 3}
          </span>
        </div>
      </NodeField>
      <div className="flex items-center gap-2">
        {["parallel", "sequential"].map(m => (
          <button key={m}
            onClick={() => updateNodeData(id, { mode: m })}
            className="flex-1 text-xs py-1 rounded-md transition-all"
            style={{
              background: d.mode === m ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${d.mode === m ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.08)"}`,
              color: d.mode === m ? "#FCD34D" : "rgba(255,255,255,0.4)",
            }}
          >
            {m === "parallel" ? "Paralelo" : "Sequencial"}
          </button>
        ))}
      </div>
    </BaseNode>
  );
});
