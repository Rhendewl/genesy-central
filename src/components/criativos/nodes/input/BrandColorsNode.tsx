"use client";

import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { BaseNode, NodeField } from "../BaseNode";
import { useWorkflowStore } from "@/store/workflow";
import type { BrandColorsNodeData } from "@/lib/workflow/types";

function ColorSwatch({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-6 h-6 rounded cursor-pointer border-0 p-0"
        style={{ background: "none" }}
      />
      <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)", fontSize: 10 }}>{label}</span>
      <span className="ml-auto text-xs font-mono" style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>
        {value}
      </span>
    </div>
  );
}

export const BrandColorsNode = memo(function BrandColorsNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const d = data as BrandColorsNodeData;

  return (
    <BaseNode id={id} type="brand-colors" selected={selected} minWidth={200}>
      <NodeField label="PALETA">
        <div className="space-y-1.5">
          <ColorSwatch label="Principal"   value={d.primary    ?? "#3B82F6"} onChange={v => updateNodeData(id, { primary: v })} />
          <ColorSwatch label="Secundária"  value={d.secondary  ?? "#1E40AF"} onChange={v => updateNodeData(id, { secondary: v })} />
          <ColorSwatch label="Destaque"    value={d.accent     ?? "#93C5FD"} onChange={v => updateNodeData(id, { accent: v })} />
          <ColorSwatch label="Fundo"       value={d.background ?? "#0A0A0A"} onChange={v => updateNodeData(id, { background: v })} />
        </div>
      </NodeField>
    </BaseNode>
  );
});
