"use client";

import { memo, useRef, useEffect, useCallback } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { X, AlignLeft } from "lucide-react";
import { useWorkflowStore } from "@/store/workflow";
import type { TextNodeData } from "@/lib/workflow/types";

const C   = "#3B82F6";
const DIM = "rgba(59,130,246,0.55)";

export const TextNode = memo(function TextNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const removeNode     = useWorkflowStore((s) => s.removeNode);
  const d = data as TextNodeData;

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => { resize(); }, [d.content, resize]);

  return (
    <div
      className="relative group"
      style={{
        minWidth: 250,
        background: "rgba(7, 9, 20, 0.58)",
        backdropFilter: "blur(28px) saturate(1.8)",
        WebkitBackdropFilter: "blur(28px) saturate(1.8)",
        border: `1px solid ${selected ? "rgba(59,130,246,0.55)" : "rgba(59,130,246,0.14)"}`,
        borderRadius: 16,
        boxShadow: selected
          ? `0 0 0 1px rgba(59,130,246,0.18), 0 0 40px rgba(59,130,246,0.1), 0 28px 80px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.07)`
          : `0 0 0 1px rgba(59,130,246,0.05), 0 0 24px rgba(59,130,246,0.05), 0 20px 60px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.05)`,
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
        style={{ borderBottom: "1px solid rgba(59,130,246,0.08)" }}
      >
        <div
          style={{
            width: 22, height: 22,
            borderRadius: 7,
            background: `${C}14`,
            border: `1px solid ${C}22`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 10px ${C}12`,
          }}
        >
          <AlignLeft size={10} style={{ color: DIM }} />
        </div>
        <input
          value={d.label ?? "Texto"}
          onChange={e => updateNodeData(id, { label: e.target.value })}
          className="bg-transparent outline-none nodrag"
          style={{
            color: DIM,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            flex: 1,
          }}
        />
        <div
          style={{
            width: 5, height: 5, borderRadius: "50%",
            background: C,
            boxShadow: `0 0 6px ${C}`,
            opacity: 0.7,
          }}
        />
      </div>

      {/* Textarea */}
      <div className="px-3.5 pb-3.5 pt-2.5">
        <textarea
          ref={textareaRef}
          value={d.content ?? ""}
          onChange={e => { updateNodeData(id, { content: e.target.value }); resize(); }}
          placeholder="Escreva aqui o prompt, copy, headline, CTA..."
          rows={3}
          className="w-full resize-none outline-none rounded-xl px-3 py-2.5 nodrag overflow-hidden"
          style={{
            background: "rgba(59,130,246,0.04)",
            border: "1px solid rgba(59,130,246,0.09)",
            color: "rgba(255,255,255,0.72)",
            fontSize: 11,
            lineHeight: 1.7,
            caretColor: C,
            minHeight: 64,
            transition: "border-color 0.15s ease, background 0.15s ease",
          }}
          onFocus={e => {
            e.target.style.borderColor = "rgba(59,130,246,0.35)";
            e.target.style.background = "rgba(59,130,246,0.06)";
          }}
          onBlur={e => {
            e.target.style.borderColor = "rgba(59,130,246,0.09)";
            e.target.style.background = "rgba(59,130,246,0.04)";
          }}
        />
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: 9, height: 9,
          background: C,
          border: "2px solid rgba(7,9,20,0.9)",
          borderRadius: "50%",
          boxShadow: `0 0 10px ${C}, 0 0 4px ${C}`,
          right: -4.5,
        }}
      />
    </div>
  );
});
