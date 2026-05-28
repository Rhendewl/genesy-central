"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { X, Copy, Download, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useWorkflowStore } from "@/store/workflow";
import type { ResultNodeData, NodeExecutionStatus } from "@/lib/workflow/types";
import { toast } from "sonner";

const C   = "#10B981";
const DIM = "rgba(16,185,129,0.6)";

export const ResultNode = memo(function ResultNode({ id, data, selected }: NodeProps) {
  const removeNode = useWorkflowStore((s) => s.removeNode);
  const requestRun = useWorkflowStore((s) => s.requestRun);
  const d = data as ResultNodeData;

  const status: NodeExecutionStatus = (d.executionStatus as NodeExecutionStatus) ?? "idle";
  const output   = d.executionOutput as Record<string, unknown> | undefined;
  const text     = (output?.generated_text      as string | undefined) ?? null;
  const imageUrl = (output?.generated_image_url as string | undefined) ?? null;
  const hasText  = !!(text?.trim());
  const hasImage = !!(imageUrl?.trim());
  const hasContent = hasText || hasImage;
  const isRunning  = status === "running";

  return (
    <div
      className="relative group"
      style={{
        minWidth: 250,
        background: "rgba(4, 12, 9, 0.58)",
        backdropFilter: "blur(28px) saturate(1.8)",
        WebkitBackdropFilter: "blur(28px) saturate(1.8)",
        border: `1px solid ${selected ? "rgba(16,185,129,0.55)" : "rgba(16,185,129,0.13)"}`,
        borderRadius: 16,
        boxShadow: selected
          ? `0 0 0 1px rgba(16,185,129,0.18), 0 0 40px rgba(16,185,129,0.1), 0 28px 80px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.07)`
          : `0 0 0 1px rgba(16,185,129,0.05), 0 0 24px rgba(16,185,129,0.04), 0 20px 60px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.05)`,
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
      }}
    >
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
        className="flex items-center gap-2 px-3.5 pt-3 pb-2"
        style={{ borderBottom: "1px solid rgba(16,185,129,0.08)" }}
      >
        <div
          style={{
            width: 22, height: 22, borderRadius: 7,
            background: `${C}14`, border: `1px solid ${C}22`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 10px ${C}12`,
          }}
        >
          <Sparkles size={10} style={{ color: DIM }} />
        </div>
        <span style={{ color: DIM, fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", flex: 1 }}>
          Resultado
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          {hasText && (
            <button
              onClick={() => { navigator.clipboard?.writeText(text!); toast.success("Copiado!"); }}
              className="nodrag transition-all hover:opacity-70"
              title="Copiar texto"
            >
              <Copy size={10} style={{ color: "rgba(255,255,255,0.3)" }} />
            </button>
          )}
          {hasImage && (
            <a href={imageUrl!} download target="_blank" rel="noreferrer" title="Download" className="transition-all hover:opacity-70">
              <Download size={10} style={{ color: "rgba(255,255,255,0.3)" }} />
            </a>
          )}

          {/* Regenerar */}
          <motion.button
            onClick={() => requestRun()}
            disabled={isRunning}
            whileHover={isRunning ? {} : { scale: 1.05 }}
            whileTap={isRunning ? {} : { scale: 0.93 }}
            className="flex items-center gap-1 nodrag"
            style={{
              padding: "3px 8px",
              borderRadius: 8,
              background: isRunning ? `${C}08` : `${C}12`,
              border: `1px solid ${isRunning ? `${C}15` : `${C}30`}`,
              color: isRunning ? `${C}50` : C,
              fontSize: 8.5,
              fontWeight: 500,
              cursor: isRunning ? "default" : "pointer",
              letterSpacing: "0.04em",
              boxShadow: isRunning ? "none" : `0 0 8px ${C}15`,
            }}
          >
            <RefreshCw size={8} className={isRunning ? "animate-spin" : ""} />
            <span>Gerar</span>
          </motion.button>
        </div>
      </div>

      {/* Content */}
      <div className="px-3.5 pb-3.5 pt-2.5">
        <AnimatePresence mode="wait">
          {isRunning ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center gap-2.5 py-8 rounded-xl"
              style={{ background: `${C}06`, border: `1px solid ${C}10` }}
            >
              <div
                style={{
                  width: 28, height: 28, borderRadius: "50%",
                  border: `1.5px solid ${C}30`,
                  borderTop: `1.5px solid ${C}`,
                  animation: "spin 0.9s linear infinite",
                  boxShadow: `0 0 12px ${C}30`,
                }}
              />
              <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, letterSpacing: "0.04em" }}>
                Gerando...
              </span>
            </motion.div>
          ) : !hasContent ? (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-9 rounded-xl"
              style={{ background: "rgba(255,255,255,0.012)", border: "1px dashed rgba(255,255,255,0.055)" }}
            >
              <div
                style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: `${C}10`, border: `1px solid ${C}18`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 8,
                  boxShadow: `0 0 16px ${C}10`,
                }}
              >
                <Sparkles size={12} style={{ color: `${C}70` }} />
              </div>
              <p style={{ color: "rgba(255,255,255,0.18)", fontSize: 10, letterSpacing: "0.03em" }}>
                Aguardando geração
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="space-y-2.5"
            >
              {hasText && (
                <div
                  className="rounded-xl p-3"
                  style={{ background: `${C}06`, border: `1px solid ${C}12` }}
                >
                  <p style={{ color: "rgba(255,255,255,0.78)", fontSize: 11, lineHeight: 1.7, whiteSpace: "pre-wrap", letterSpacing: "0.01em" }}>
                    {text}
                  </p>
                </div>
              )}
              {hasImage && (
                <div
                  className="rounded-xl overflow-hidden"
                  style={{ border: `1px solid ${C}18`, boxShadow: `0 0 20px ${C}08` }}
                >
                  <img src={imageUrl!} alt="Criativo gerado" className="w-full object-cover" style={{ maxHeight: 190 }} />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: 9, height: 9,
          background: C,
          border: "2px solid rgba(4,12,9,0.9)",
          borderRadius: "50%",
          boxShadow: `0 0 10px ${C}, 0 0 4px ${C}`,
          left: -4.5,
        }}
      />
    </div>
  );
});
