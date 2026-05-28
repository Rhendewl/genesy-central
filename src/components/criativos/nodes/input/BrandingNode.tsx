"use client";

import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { BaseNode, NodeField, NodeSelect } from "../BaseNode";
import { useWorkflowStore } from "@/store/workflow";
import type { BrandingNodeData } from "@/lib/workflow/types";

const SEGMENT_OPTIONS = [
  { value: "imobiliario", label: "Imobiliário" },
  { value: "varejo",      label: "Varejo" },
  { value: "servicos",    label: "Serviços" },
  { value: "saude",       label: "Saúde" },
  { value: "educacao",    label: "Educação" },
  { value: "outro",       label: "Outro" },
];

const TONE_OPTIONS = [
  { value: "profissional", label: "Profissional" },
  { value: "urgente",      label: "Urgente" },
  { value: "sofisticado",  label: "Sofisticado" },
  { value: "amigavel",     label: "Amigável" },
  { value: "emocional",    label: "Emocional" },
  { value: "direto",       label: "Direto" },
];

export const BrandingNode = memo(function BrandingNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const d = data as BrandingNodeData;

  return (
    <BaseNode id={id} type="branding" selected={selected} minWidth={220}>
      <NodeField label="MARCA">
        <input
          type="text"
          value={d.brand_name ?? ""}
          onChange={e => updateNodeData(id, { brand_name: e.target.value })}
          placeholder="Nome da marca"
          className="w-full rounded-md px-2 py-1.5 text-xs outline-none focus:ring-1"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.85)",
          }}
        />
      </NodeField>
      <NodeField label="SEGMENTO">
        <NodeSelect
          value={d.segment ?? "imobiliario"}
          onChange={(v) => updateNodeData(id, { segment: v })}
          options={SEGMENT_OPTIONS}
        />
      </NodeField>
      <NodeField label="TOM">
        <NodeSelect
          value={d.tone ?? "profissional"}
          onChange={(v) => updateNodeData(id, { tone: v })}
          options={TONE_OPTIONS}
        />
      </NodeField>
    </BaseNode>
  );
});
