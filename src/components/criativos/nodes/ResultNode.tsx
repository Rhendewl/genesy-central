"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { X, Copy, Download, Loader2, RefreshCw } from "lucide-react";
import { useWorkflowStore } from "@/store/workflow";
import type { ResultNodeData, NodeExecutionStatus } from "@/lib/workflow/types";
import { toast } from "sonner";

const C = "#10B981";

export const ResultNode = memo(function ResultNode({ id, data, selected }: NodeProps) {
  const removeNode  = useWorkflowStore((s) => s.removeNode);
  const requestRun  = useWorkflowStore((s) => s.requestRun);
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
        minWidth: 240,
        background: "rgba(10,13,11,0.97)",
        border: `1px solid ${selected ? `${C}60` : "rgba(16,185,129,0.1)"}`,
        borderLeft: `2px solid ${selected ? C : `${C}60`}`,
        borderRadius: 10,
        boxShadow: selected
          ? `0 0 0 1px ${C}20, 0 8px 32px rgba(0,0,0,0.7)`
          : `0 0 16px ${C}05, 0 2px 16px rgba(0,0,0,0.5)`,
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
    >
      <button
        onClick={e => { e.stopPropagation(); removeNode(id); }}
        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center
                   opacity-0 group-hover:opacity-100 transition-opacity z-10"
        style={{ background: "#EF4444" }}
      >
        <X size={8} className="text-white" />
      </button>

      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
        <span style={{ color: C, fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em" }}>
          Resultado
        </span>
        <div className="flex items-center gap-2">
          {hasContent && (
            <>
              {hasText && (
                <button
                  onClick={() => { navigator.clipboard?.writeText(text!); toast.success("Copiado!"); }}
                  className="transition-opacity hover:opacity-60 nodrag"
                  title="Copiar texto"
                >
                  <Copy size={10} style={{ color: "rgba(255,255,255,0.35)" }} />
                </button>
              )}
              {hasImage && (
                <a
                  href={imageUrl!}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="transition-opacity hover:opacity-60"
                  title="Download imagem"
                >
                  <Download size={10} style={{ color: "rgba(255,255,255,0.35)" }} />
                </a>
              )}
            </>
          )}
          {/* Regenerar */}
          <button
            onClick={() => requestRun()}
            disabled={isRunning}
            className="flex items-center gap-1 px-2 py-0.5 rounded nodrag transition-all"
            style={{
              background: isRunning ? "rgba(16,185,129,0.05)" : "rgba(16,185,129,0.1)",
              border: `1px solid ${isRunning ? `${C}15` : `${C}30`}`,
              color: isRunning ? `${C}50` : C,
              fontSize: 8,
              cursor: isRunning ? "default" : "pointer",
            }}
            title="Regenerar"
          >
            <RefreshCw size={8} className={isRunning ? "animate-spin" : ""} />
            <span>Gerar</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 pb-3">
        {isRunning ? (
          <div
            className="flex items-center justify-center gap-2 py-6 rounded-lg"
            style={{ background: `${C}08`, border: `1px solid ${C}12` }}
          >
            <Loader2 size={13} style={{ color: C }} className="animate-spin" />
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>Gerando...</span>
          </div>
        ) : !hasContent ? (
          <div
            className="flex flex-col items-center justify-center py-7 rounded-lg"
            style={{ background: "rgba(255,255,255,0.015)", border: "1px dashed rgba(255,255,255,0.05)" }}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center mb-2"
              style={{ background: `${C}12` }}
            >
              <span style={{ color: `${C}80`, fontSize: 12, lineHeight: 1 }}>◎</span>
            </div>
            <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>Aguardando geração</p>
          </div>
        ) : (
          <div className="space-y-2">
            {hasText && (
              <div
                className="rounded-lg p-2.5"
                style={{ background: `${C}07`, border: `1px solid ${C}15` }}
              >
                <p style={{ color: "rgba(255,255,255,0.78)", fontSize: 11, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                  {text}
                </p>
              </div>
            )}
            {hasImage && (
              <img
                src={imageUrl!}
                alt="Criativo gerado"
                className="w-full rounded-lg object-cover"
                style={{ maxHeight: 180 }}
              />
            )}
          </div>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        style={{ width: 8, height: 8, background: C, border: "2px solid rgba(10,13,11,0.97)", left: -4 }}
      />
    </div>
  );
});
