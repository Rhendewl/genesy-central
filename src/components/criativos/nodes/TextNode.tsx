"use client";

import { memo, useRef, useEffect, useCallback } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { X } from "lucide-react";
import { useWorkflowStore } from "@/store/workflow";
import type { TextNodeData } from "@/lib/workflow/types";

const C = "#3B82F6";

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
        minWidth: 240,
        background: "rgba(10,10,12,0.97)",
        border: `1px solid ${selected ? `${C}60` : "rgba(255,255,255,0.06)"}`,
        borderLeft: `2px solid ${selected ? C : `${C}80`}`,
        borderRadius: 10,
        boxShadow: selected
          ? `0 0 0 1px ${C}20, 0 8px 32px rgba(0,0,0,0.7)`
          : "0 2px 16px rgba(0,0,0,0.5)",
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

      <div className="px-3 pt-2.5 pb-1">
        <input
          value={d.label ?? "Texto"}
          onChange={e => updateNodeData(id, { label: e.target.value })}
          className="bg-transparent outline-none w-full uppercase tracking-widest nodrag"
          style={{ color: C, fontSize: 9, fontWeight: 600, letterSpacing: "0.12em" }}
        />
      </div>

      <div className="px-3 pb-3">
        <textarea
          ref={textareaRef}
          value={d.content ?? ""}
          onChange={e => {
            updateNodeData(id, { content: e.target.value });
            resize();
          }}
          placeholder="Escreva aqui..."
          rows={3}
          className="w-full resize-none outline-none rounded-lg px-2.5 py-2 nodrag overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.05)",
            color: "rgba(255,255,255,0.75)",
            fontSize: 11,
            lineHeight: 1.65,
            caretColor: C,
            minHeight: 60,
          }}
          onFocus={e => (e.target.style.borderColor = `${C}50`)}
          onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.05)")}
        />
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{ width: 8, height: 8, background: C, border: "2px solid rgba(10,10,12,0.97)", right: -4 }}
      />
    </div>
  );
});
