"use client";

import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { BaseNode, NodeField } from "../BaseNode";
import { useWorkflowStore } from "@/store/workflow";
import type { RandomizerNodeData } from "@/lib/workflow/types";

export const RandomizerNode = memo(function RandomizerNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const d = data as RandomizerNodeData;

  return (
    <BaseNode id={id} type="randomizer" selected={selected} minWidth={200}>
      <NodeField label="SELECIONAR ALEATORIAMENTE">
        <div className="flex items-center gap-2">
          <input
            type="range" min={1} max={5} step={1}
            value={d.pick ?? 1}
            onChange={e => updateNodeData(id, { pick: Number(e.target.value) })}
            className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: "#F59E0B" }}
          />
          <span className="text-xs w-12 shrink-0" style={{ color: "rgba(255,255,255,0.7)" }}>
            {d.pick ?? 1} opção{(d.pick ?? 1) > 1 ? "ões" : ""}
          </span>
        </div>
      </NodeField>
      <div
        className="rounded px-2 py-1.5 text-xs text-center"
        style={{
          background: "rgba(245,158,11,0.06)",
          border: "1px dashed rgba(245,158,11,0.2)",
          color: "rgba(245,158,11,0.6)",
        }}
      >
        Escolhe aleatoriamente da entrada
      </div>
    </BaseNode>
  );
});
