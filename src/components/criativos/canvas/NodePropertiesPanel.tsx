"use client";

import { Trash2, X } from "lucide-react";
import { useWorkflowStore } from "@/store/workflow";
import { NODE_META_MAP, CATEGORY_COLORS } from "../nodes/nodeRegistry";
import type { WorkflowNodeType } from "@/lib/workflow/types";

export function NodePropertiesPanel() {
  const { selectedNodeId, nodes, removeNode, setSelectedNodeId } = useWorkflowStore();

  const node = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;
  if (!node) return null;

  const type = node.type as WorkflowNodeType;
  const meta = NODE_META_MAP[type];
  if (!meta) return null;

  const colors = CATEGORY_COLORS[meta.category];

  const handleDelete = () => {
    removeNode(node.id);
  };

  return (
    <aside
      className="flex flex-col h-full"
      style={{
        width: 220,
        background: "rgba(10,10,12,0.95)",
        borderLeft: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-3 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: colors.primary }}
          />
          <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.8)", fontSize: 11 }}>
            {meta.label}
          </span>
        </div>
        <button
          onClick={() => setSelectedNodeId(null)}
          className="transition-opacity hover:opacity-70"
          style={{ color: "rgba(255,255,255,0.3)" }}
        >
          <X size={12} />
        </button>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-3 p-3 flex-1">
        <div
          className="rounded-md px-2 py-1.5"
          style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
        >
          <span className="text-xs" style={{ color: colors.text, fontSize: 10 }}>
            {meta.description}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <Row label="Categoria" value={meta.category} />
          <Row label="Entradas" value={`${meta.inputs} conexão${meta.inputs !== 1 ? "ões" : ""}`} />
          <Row label="Saídas" value={`${meta.outputs} saída${meta.outputs !== 1 ? "s" : ""}`} />
          <Row label="ID" value={node.id} mono />
        </div>
      </div>

      {/* Delete */}
      <div className="p-3 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <button
          onClick={handleDelete}
          className="w-full flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md transition-all hover:opacity-80"
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
            color: "#FCA5A5",
          }}
        >
          <Trash2 size={11} />
          Remover Node
        </button>
      </div>
    </aside>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 10 }}>{label}</span>
      <span
        className={mono ? "font-mono truncate max-w-[120px]" : ""}
        style={{ color: "rgba(255,255,255,0.65)", fontSize: 10 }}
      >
        {value}
      </span>
    </div>
  );
}
