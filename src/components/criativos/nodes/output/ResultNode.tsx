"use client";

import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { CheckCircle2 } from "lucide-react";
import { BaseNode } from "../BaseNode";
import { useWorkflowStore } from "@/store/workflow";
import type { ResultNodeData } from "@/lib/workflow/types";

export const ResultNode = memo(function ResultNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const d = data as ResultNodeData;

  return (
    <BaseNode id={id} type="result" selected={selected} minWidth={200}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-center gap-2 py-2 rounded-md" style={{ background: "rgba(16,185,129,0.06)", border: "1px dashed rgba(16,185,129,0.2)" }}>
          <CheckCircle2 size={16} style={{ color: "rgba(16,185,129,0.5)" }} />
          <span style={{ color: "rgba(16,185,129,0.7)", fontSize: 10 }}>Salva criativo gerado</span>
        </div>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={!!d.auto_download}
            onChange={e => updateNodeData(id, { auto_download: e.target.checked })}
            className="w-3 h-3 rounded"
            style={{ accentColor: "#10B981" }}
          />
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)", fontSize: 10 }}>Download automático</span>
        </label>
      </div>
    </BaseNode>
  );
});
