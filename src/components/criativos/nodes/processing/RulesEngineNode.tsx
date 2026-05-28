"use client";

import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { Plus, Trash2 } from "lucide-react";
import { BaseNode, NodeField } from "../BaseNode";
import { useWorkflowStore } from "@/store/workflow";
import type { RulesEngineNodeData } from "@/lib/workflow/types";

export const RulesEngineNode = memo(function RulesEngineNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const d = data as RulesEngineNodeData;
  const rules: Array<{ condition: string; action: string }> = d.rules ?? [];

  const addRule = () => {
    updateNodeData(id, { rules: [...rules, { condition: "", action: "" }] });
  };

  const removeRule = (i: number) => {
    updateNodeData(id, { rules: rules.filter((_, idx) => idx !== i) });
  };

  const updateRule = (i: number, field: "condition" | "action", val: string) => {
    const next = rules.map((r, idx) => idx === i ? { ...r, [field]: val } : r);
    updateNodeData(id, { rules: next });
  };

  return (
    <BaseNode id={id} type="rules-engine" selected={selected} minWidth={240}>
      <NodeField label="REGRAS CONDICIONAIS">
        <div className="flex flex-col gap-1.5">
          {rules.map((rule, i) => (
            <div key={i} className="flex flex-col gap-1 p-1.5 rounded" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <input
                value={rule.condition}
                onChange={e => updateRule(i, "condition", e.target.value)}
                placeholder="Condição..."
                className="w-full text-xs rounded px-2 py-1 outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)" }}
              />
              <div className="flex gap-1">
                <input
                  value={rule.action}
                  onChange={e => updateRule(i, "action", e.target.value)}
                  placeholder="Ação..."
                  className="flex-1 text-xs rounded px-2 py-1 outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)" }}
                />
                <button onClick={() => removeRule(i)} style={{ color: "rgba(239,68,68,0.6)" }}>
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={addRule}
            className="flex items-center justify-center gap-1 text-xs py-1 rounded transition-all"
            style={{
              background: "rgba(245,158,11,0.06)",
              border: "1px dashed rgba(245,158,11,0.2)",
              color: "rgba(245,158,11,0.7)",
            }}
          >
            <Plus size={10} /> Adicionar Regra
          </button>
        </div>
      </NodeField>
    </BaseNode>
  );
});
