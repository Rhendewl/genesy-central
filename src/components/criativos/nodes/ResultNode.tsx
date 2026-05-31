"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { X, Copy, Download, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useWorkflowStore } from "@/store/workflow";
import type { ResultNodeData, NodeExecutionStatus } from "@/lib/workflow/types";
import { ASPECT_RATIO_FORMATS } from "@/lib/workflow/types";
import type { AspectRatio } from "@/lib/workflow/types";
import { toast } from "sonner";

const C   = "#10B981";
const DIM = "rgba(16,185,129,0.6)";

// ── Aspect ratio selector ──────────────────────────────────────────────────────

function FormatSelector({
  selected,
  onChange,
}: {
  selected: AspectRatio;
  onChange: (r: AspectRatio) => void;
}) {
  return (
    <div className="px-3 pb-2">
      {/* Label */}
      <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 6 }}>
        Formato
      </p>

      {/* Cards row */}
      <div className="flex gap-1">
        {ASPECT_RATIO_FORMATS.map((fmt) => {
          const isActive = selected === fmt.ratio;
          return (
            <button
              key={fmt.ratio}
              onClick={() => onChange(fmt.ratio)}
              className="nodrag flex-1 flex flex-col items-center gap-1.5 transition-all"
              style={{
                padding: "7px 2px 6px",
                borderRadius: 9,
                background: isActive ? `${C}14` : "rgba(255,255,255,0.025)",
                border: `1px solid ${isActive ? `${C}55` : "rgba(255,255,255,0.055)"}`,
                boxShadow: isActive ? `0 0 12px ${C}18, inset 0 1px 0 ${C}10` : "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title={`${fmt.label} — ${fmt.sub}\n${fmt.openaiSize}`}
            >
              {/* Mini rectangle preview */}
              <div style={{ width: 28, height: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <motion.div
                  animate={isActive ? { boxShadow: `0 0 6px ${C}60` } : { boxShadow: "none" }}
                  transition={{ duration: 0.2 }}
                  style={{
                    width: fmt.vw,
                    height: fmt.vh,
                    borderRadius: 2,
                    background: isActive ? `${C}28` : "rgba(255,255,255,0.05)",
                    border: `1px solid ${isActive ? `${C}80` : "rgba(255,255,255,0.12)"}`,
                    transition: "background 0.15s, border-color 0.15s",
                  }}
                />
              </div>

              {/* Ratio */}
              <span style={{
                fontSize: 7.5,
                fontWeight: 600,
                letterSpacing: "0.03em",
                color: isActive ? C : "rgba(255,255,255,0.3)",
                lineHeight: 1,
                transition: "color 0.15s",
              }}>
                {fmt.sub}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── ResultNode ─────────────────────────────────────────────────────────────────

export const ResultNode = memo(function ResultNode({ id, data, selected }: NodeProps) {
  const removeNode           = useWorkflowStore((s) => s.removeNode);
  const requestRunForResult  = useWorkflowStore((s) => s.requestRunForResult);
  const updateNodeData       = useWorkflowStore((s) => s.updateNodeData);
  const d = data as ResultNodeData;

  const aspectRatio: AspectRatio = (d.aspectRatio as AspectRatio | undefined) ?? "1:1";
  const status: NodeExecutionStatus = (d.executionStatus as NodeExecutionStatus) ?? "idle";
  const output   = d.executionOutput as Record<string, unknown> | undefined;
  const text     = (output?.generated_text      as string | undefined) ?? null;
  const imageUrl = (output?.generated_image_url as string | undefined) ?? null;
  const hasText  = !!(text?.trim());
  const hasImage = !!(imageUrl?.trim());
  const hasContent = hasText || hasImage;
  const isRunning  = status === "running";

  // Aspect ratio atual — para exibir a imagem com a proporção correta
  const currentFormat = ASPECT_RATIO_FORMATS.find(f => f.ratio === aspectRatio) ?? ASPECT_RATIO_FORMATS[0];
  const [imgW, imgH] = currentFormat.openaiSize.split("x").map(Number);
  const imgAspect = imgW / imgH;

  return (
    <div
      className="relative group"
      style={{
        minWidth: 260,
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

          {/* Gerar / Regenerar */}
          <motion.button
            onClick={() => requestRunForResult(id)}
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
            <span>{hasContent ? "Regerar" : "Gerar"}</span>
          </motion.button>
        </div>
      </div>

      {/* ── Formato selector ──────────────────────────────────────────── */}
      <div style={{ borderBottom: "1px solid rgba(16,185,129,0.06)", paddingTop: 10 }}>
        <FormatSelector
          selected={aspectRatio}
          onChange={(r) => updateNodeData(id, { aspectRatio: r })}
        />
      </div>

      {/* ── Content ───────────────────────────────────────────────────── */}
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
                Gerando {currentFormat.sub}...
              </span>
            </motion.div>
          ) : !hasContent ? (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-8 rounded-xl"
              style={{ background: "rgba(255,255,255,0.012)", border: "1px dashed rgba(255,255,255,0.055)" }}
            >
              {/* Mini preview do formato selecionado como placeholder */}
              <div style={{
                marginBottom: 10,
                opacity: 0.3,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 44,
                height: 44,
              }}>
                <div style={{
                  width: currentFormat.vw * 1.7,
                  height: currentFormat.vh * 1.7,
                  borderRadius: 3,
                  border: `1.5px dashed ${C}`,
                  background: `${C}08`,
                }} />
              </div>
              <p style={{ color: "rgba(255,255,255,0.18)", fontSize: 10, letterSpacing: "0.03em" }}>
                Aguardando geração
              </p>
              <p style={{ color: "rgba(255,255,255,0.1)", fontSize: 8.5, marginTop: 3, letterSpacing: "0.02em" }}>
                {currentFormat.sub}
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
                  <img
                    src={imageUrl!}
                    alt="Criativo gerado"
                    className="w-full object-cover"
                    style={{
                      // Respeita o aspect ratio do formato gerado
                      aspectRatio: `${imgAspect}`,
                      maxHeight: 200,
                    }}
                  />
                  {/* Badge do formato gerado */}
                  <div
                    className="flex items-center justify-between px-2.5 py-1.5"
                    style={{ background: "rgba(0,0,0,0.4)", borderTop: `1px solid ${C}12` }}
                  >
                    <span style={{ color: `${C}99`, fontSize: 8, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      {currentFormat.label}
                    </span>
                    <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 8 }}>
                      {currentFormat.openaiSize}
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="nh-green"
        style={{ left: -12 }}
      />
    </div>
  );
});
