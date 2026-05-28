"use client";

import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { BaseNode, NodeField, NodeSelect } from "../BaseNode";
import { useWorkflowStore } from "@/store/workflow";
import type { HeadlineGeneratorNodeData } from "@/lib/workflow/types";

const MODEL_OPTIONS = [
  { value: "anthropic", label: "Claude" },
  { value: "openai",    label: "GPT-4o" },
  { value: "gemini",    label: "Gemini" },
];

const STYLE_OPTIONS = [
  { value: "benefit",   label: "Benefício" },
  { value: "question",  label: "Pergunta" },
  { value: "statement", label: "Declaração" },
  { value: "command",   label: "Comando" },
];

export const HeadlineGeneratorNode = memo(function HeadlineGeneratorNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const d = data as HeadlineGeneratorNodeData;

  return (
    <BaseNode id={id} type="headline-generator" selected={selected} minWidth={210}>
      <NodeField label="MODELO">
        <NodeSelect value={d.model ?? "anthropic"} onChange={v => updateNodeData(id, { model: v })} options={MODEL_OPTIONS} />
      </NodeField>
      <NodeField label="ESTILO">
        <NodeSelect value={d.style ?? "benefit"} onChange={v => updateNodeData(id, { style: v })} options={STYLE_OPTIONS} />
      </NodeField>
    </BaseNode>
  );
});
