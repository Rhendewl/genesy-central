"use client";

import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { BaseNode, NodeField, NodeSelect } from "../BaseNode";
import { useWorkflowStore } from "@/store/workflow";
import type { CTAGeneratorNodeData } from "@/lib/workflow/types";

const ACTION_OPTIONS = [
  { value: "discover",  label: "Descobrir" },
  { value: "buy",       label: "Comprar" },
  { value: "contact",   label: "Contato" },
  { value: "schedule",  label: "Agendar" },
  { value: "download",  label: "Baixar" },
];

export const CTAGeneratorNode = memo(function CTAGeneratorNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const d = data as CTAGeneratorNodeData;

  return (
    <BaseNode id={id} type="cta-generator" selected={selected} minWidth={200}>
      <NodeField label="AÇÃO PRINCIPAL">
        <NodeSelect
          value={d.action_type ?? "discover"}
          onChange={v => updateNodeData(id, { action_type: v })}
          options={ACTION_OPTIONS}
        />
      </NodeField>
    </BaseNode>
  );
});
