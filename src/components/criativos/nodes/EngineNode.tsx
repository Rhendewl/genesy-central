"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { Zap, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { useWorkflowStore } from "@/store/workflow";
import type { EngineNodeData, NodeExecutionStatus } from "@/lib/workflow/types";

const C   = "#8B5CF6";
const DIM = "rgba(139,92,246,0.65)";

const PROVIDERS = [
  { value: "openai",    label: "OpenAI" },
  { value: "gemini",    label: "Gemini" },
  { value: "anthropic", label: "Claude" },
] as const;

const MODES = [
  { value: "copy",  label: "Texto"  },
  { value: "image", label: "Imagem" },
  { value: "both",  label: "Ambos"  },
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
        minWidth: 270,
        background: "rgba(8, 5, 18, 0.62)",
        backdropFilter: "blur(32px) saturate(1.9)",
        WebkitBackdropFilter: "blur(32px) saturate(1.9)",
        border: `1px solid ${selected ? "rgba(139,92,246,0.6)" : "rgba(139,92,246,0.18)"}`,
        borderRadius: 18,
        boxShadow: selected
          ? `0 0 0 1px rgba(139,92,246,0.22), 0 0 50px rgba(139,92,246,0.14), 0 32px 90px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.08)`
          : `0 0 0 1px rgba(139,92,246,0.07), 0 0 30px rgba(139,92,246,0.07), 0 24px 70px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05)`,
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
      }}
    >
      {/* Running pulse ring */}
      {isRunning && (
        <div
          className="absolute inset-0 pointer-events-none animate-pulse"
          style={{ border: `1px solid rgba(139,92,246,0.4)`, borderRadius: 18 }}
        />
      )}

      {/* Delete */}
      <button
        onClick={e => { e.stopPropagation(); removeNode(id); }}
        className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center
                   opacity-0 group-hover:opacity-100 z-10"
        style={{
          background: "rgba(239,68,68,0.85)",
          border: "1px solid rgba(239,68,68,0.4)",
          boxShadow: "0 0 10px rgba(239,68,68,0.4)",
          transition: "opacity 0.15s ease",
        }}
      >
        <X size={9} className="text-white" />
      </button>

      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-4 py-3"
        style={{ borderBottom: "1px solid rgba(139,92,246,0.1)" }}
      >
        <div
          style={{
            width: 30, height: 30, borderRadius: 10,
            background: `${C}15`, border: `1px solid ${C}28`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 16px ${C}12, inset 0 1px 0 ${C}15`,
            flexShrink: 0,
          }}
        >
          {isRunning
            ? <Loader2 size={13} style={{ color: C }} className="animate-spin" />
            : status === "success"
            ? <CheckCircle2 size={13} style={{ color: "#10B981" }} />
            : status === "error"
            ? <AlertCircle size={13} style={{ color: "#EF4444" }} />
            : <Zap size={13} style={{ color: C, filter: `drop-shadow(0 0 4px ${DIM})` }} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p style={{ color: DIM, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em" }}>
            Engine
          </p>
          <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 9, marginTop: 1, letterSpacing: "0.02em" }}>
            {isRunning ? "Orquestrando..." : "AI Creative Engine"}
          </p>
        </div>
        <div style={{ width: 5, height: 5, borderRadius: "50%", background: C, boxShadow: `0 0 8px ${C}`, opacity: isRunning ? 1 : 0.6 }} />
      </div>

      {/* Body */}
      <div className="p-3.5 space-y-3">
        {/* Provider selector */}
        <div>
          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 6 }}>
            Provider
          </p>
          <div className="flex gap-1.5">
            {PROVIDERS.map(p => {
              const active = d.provider === p.value;
              return (
                <button
                  key={p.value}
                  onClick={() => updateNodeData(id, { provider: p.value })}
                  className="flex-1 transition-all nodrag"
                  style={{
                    padding: "5px 0",
                    borderRadius: 8,
                    fontSize: 9,
                    fontWeight: 500,
                    letterSpacing: "0.03em",
                    background: active ? `${C}18` : "rgba(255,255,255,0.025)",
                    border: `1px solid ${active ? `${C}50` : "rgba(255,255,255,0.06)"}`,
                    color: active ? C : "rgba(255,255,255,0.3)",
                    boxShadow: active ? `0 0 10px ${C}14` : "none",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mode selector */}
        <div>
          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 6 }}>
            Modo
          </p>
          <div className="flex gap-1.5">
            {MODES.map(m => {
              const active = d.mode === m.value;
              return (
                <button
                  key={m.value}
                  onClick={() => updateNodeData(id, { mode: m.value })}
                  className="flex-1 transition-all nodrag"
                  style={{
                    padding: "5px 0",
                    borderRadius: 8,
                    fontSize: 9,
                    fontWeight: 500,
                    letterSpacing: "0.03em",
                    background: active ? `${C}18` : "rgba(255,255,255,0.025)",
                    border: `1px solid ${active ? `${C}50` : "rgba(255,255,255,0.06)"}`,
                    color: active ? C : "rgba(255,255,255,0.3)",
                    boxShadow: active ? `0 0 10px ${C}14` : "none",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Image mode warning */}
        {(d.mode === "image" || d.mode === "both") && (
          <div
            className="flex items-start gap-2 px-2.5 py-2 rounded-lg"
            style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.14)" }}
          >
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#FCD34D", marginTop: 3, flexShrink: 0, boxShadow: "0 0 4px #FCD34D" }} />
            <p style={{ color: "rgba(252,211,77,0.75)", fontSize: 9, lineHeight: 1.55, letterSpacing: "0.02em" }}>
              Imagens via DALL-E 3 — requer chave OpenAI.
            </p>
          </div>
        )}

        {/* Error */}
        {status === "error" && d.executionError && (
          <div
            className="px-2.5 py-2 rounded-lg"
            style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.14)" }}
          >
            <p style={{ color: "rgba(252,165,165,0.85)", fontSize: 9, lineHeight: 1.55 }}>
              {d.executionError}
            </p>
          </div>
        )}
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: 9, height: 9,
          background: C,
          border: "2px solid rgba(8,5,18,0.9)",
          borderRadius: "50%",
          boxShadow: `0 0 10px ${C}, 0 0 4px ${C}`,
          left: -4.5,
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: 9, height: 9,
          background: C,
          border: "2px solid rgba(8,5,18,0.9)",
          borderRadius: "50%",
          boxShadow: `0 0 10px ${C}, 0 0 4px ${C}`,
          right: -4.5,
        }}
      />
    </div>
  );
});
