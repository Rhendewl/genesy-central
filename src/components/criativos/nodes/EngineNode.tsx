"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { Zap, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { useWorkflowStore } from "@/store/workflow";
import type { EngineNodeData, NodeExecutionStatus } from "@/lib/workflow/types";

const C = "#8B5CF6";

const PROVIDERS = [
  { value: "openai",    label: "OpenAI" },
  { value: "gemini",    label: "Gemini" },
  { value: "anthropic", label: "Anthropic" },
] as const;

const MODES = [
  { value: "copy",  label: "Texto" },
  { value: "image", label: "Imagem" },
  { value: "both",  label: "Ambos" },
] as const;

export const EngineNode = memo(function EngineNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const removeNode     = useWorkflowStore((s) => s.removeNode);
  const d = data as EngineNodeData;
  const status: NodeExecutionStatus = (d.executionStatus as NodeExecutionStatus) ?? "idle";
  const isRunning = status === "running";

  return (
    <div
      className="relative group"
      style={{
        minWidth: 260,
        background: "rgba(12,10,18,0.98)",
        border: `1px solid ${selected ? `${C}70` : "rgba(139,92,246,0.18)"}`,
        borderRadius: 12,
        boxShadow: selected
          ? `0 0 0 1px ${C}25, 0 0 40px ${C}12, 0 8px 32px rgba(0,0,0,0.75)`
          : `0 0 24px ${C}07, 0 4px 20px rgba(0,0,0,0.6)`,
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
    >
      {isRunning && (
        <div
          className="absolute inset-0 rounded-xl pointer-events-none animate-pulse"
          style={{ border: `1px solid ${C}35`, borderRadius: 12 }}
        />
      )}

      <button
        onClick={e => { e.stopPropagation(); removeNode(id); }}
        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center
                   opacity-0 group-hover:opacity-100 transition-opacity z-10"
        style={{ background: "#EF4444" }}
      >
        <X size={8} className="text-white" />
      </button>

      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-3 py-2.5"
        style={{ borderBottom: "1px solid rgba(139,92,246,0.1)" }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${C}18`, border: `1px solid ${C}25` }}
        >
          {isRunning
            ? <Loader2 size={13} style={{ color: C }} className="animate-spin" />
            : status === "success"
            ? <CheckCircle2 size={13} style={{ color: "#10B981" }} />
            : status === "error"
            ? <AlertCircle size={13} style={{ color: "#EF4444" }} />
            : <Zap size={13} style={{ color: C }} />
          }
        </div>
        <div>
          <p style={{ color: C, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em" }}>
            Engine
          </p>
          <p style={{ color: "rgba(255,255,255,0.28)", fontSize: 9, marginTop: 1 }}>
            {isRunning ? "Orquestrando..." : "AI Creative Engine"}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2.5">
        {/* Provider */}
        <div>
          <p className="mb-1" style={{ color: "rgba(255,255,255,0.25)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.12em" }}>
            Provider
          </p>
          <div className="flex gap-1">
            {PROVIDERS.map(p => (
              <button
                key={p.value}
                onClick={() => updateNodeData(id, { provider: p.value })}
                className="flex-1 transition-all nodrag"
                style={{
                  padding: "4px 0",
                  borderRadius: 6,
                  fontSize: 9,
                  fontWeight: 500,
                  background: d.provider === p.value ? `${C}20` : "rgba(255,255,255,0.03)",
                  border: `1px solid ${d.provider === p.value ? `${C}55` : "rgba(255,255,255,0.06)"}`,
                  color: d.provider === p.value ? C : "rgba(255,255,255,0.35)",
                  cursor: "pointer",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mode */}
        <div>
          <p className="mb-1" style={{ color: "rgba(255,255,255,0.25)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.12em" }}>
            Modo
          </p>
          <div className="flex gap-1">
            {MODES.map(m => (
              <button
                key={m.value}
                onClick={() => updateNodeData(id, { mode: m.value })}
                className="flex-1 transition-all nodrag"
                style={{
                  padding: "4px 0",
                  borderRadius: 6,
                  fontSize: 9,
                  fontWeight: 500,
                  background: d.mode === m.value ? `${C}20` : "rgba(255,255,255,0.03)",
                  border: `1px solid ${d.mode === m.value ? `${C}55` : "rgba(255,255,255,0.06)"}`,
                  color: d.mode === m.value ? C : "rgba(255,255,255,0.35)",
                  cursor: "pointer",
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {(d.mode === "image" || d.mode === "both") && (
          <p
            className="px-2 py-1.5 rounded-md"
            style={{ background: "rgba(245,158,11,0.07)", color: "#FCD34D", fontSize: 9, border: "1px solid rgba(245,158,11,0.15)", lineHeight: 1.5 }}
          >
            Imagens via DALL-E 3 — requer chave OpenAI.
          </p>
        )}

        {status === "error" && d.executionError && (
          <p
            className="px-2 py-1.5 rounded-md"
            style={{ background: "rgba(239,68,68,0.08)", color: "#FCA5A5", fontSize: 9, border: "1px solid rgba(239,68,68,0.15)" }}
          >
            {d.executionError}
          </p>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        style={{ width: 8, height: 8, background: C, border: "2px solid rgba(12,10,18,0.98)", left: -4 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ width: 8, height: 8, background: C, border: "2px solid rgba(12,10,18,0.98)", right: -4 }}
      />
    </div>
  );
});
