"use client";

import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { BaseNode, NodeField, NodeTextArea } from "../BaseNode";
import { useWorkflowStore } from "@/store/workflow";
import type { PromptNodeData } from "@/lib/workflow/types";

export const PromptNode = memo(function PromptNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const d = data as PromptNodeData;

  return (
    <BaseNode id={id} type="prompt" selected={selected} minWidth={240}>
      <NodeField label="CONTEXTO DA CAMPANHA">
        <NodeTextArea
          value={d.content ?? ""}
          onChange={(v) => updateNodeData(id, { content: v })}
          placeholder="Descreva o objetivo, produto e público da campanha..."
          rows={3}
        />
      </NodeField>
    </BaseNode>
  );
});
