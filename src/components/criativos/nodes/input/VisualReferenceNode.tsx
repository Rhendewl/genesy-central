"use client";

import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { BaseNode, NodeField, NodeTextArea } from "../BaseNode";
import { useWorkflowStore } from "@/store/workflow";
import type { VisualReferenceNodeData } from "@/lib/workflow/types";

export const VisualReferenceNode = memo(function VisualReferenceNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const d = data as VisualReferenceNodeData;

  return (
    <BaseNode id={id} type="visual-reference" selected={selected} minWidth={210}>
      <NodeField label="URL DA REFERÊNCIA">
        <input
          type="url"
          value={d.reference_url ?? ""}
          onChange={e => updateNodeData(id, { reference_url: e.target.value || null })}
          placeholder="https://..."
          className="w-full text-xs rounded px-2 py-1.5 outline-none"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.8)",
          }}
        />
      </NodeField>
      <NodeField label="DESCRIÇÃO DO ESTILO">
        <NodeTextArea
          value={d.description}
          onChange={v => updateNodeData(id, { description: v })}
          placeholder="Ex: Minimalista, tons neutros, tipografia bold..."
          rows={2}
        />
      </NodeField>
    </BaseNode>
  );
});
