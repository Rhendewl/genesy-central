"use client";

import { Type, ImageIcon, Zap, Circle } from "lucide-react";
import type { WorkflowNodeType } from "@/lib/workflow/types";

const ITEMS: Array<{
  type: WorkflowNodeType;
  label: string;
  Icon: React.ElementType;
  color: string;
}> = [
  { type: "text",   label: "Texto",     Icon: Type,      color: "#3B82F6" },
  { type: "media",  label: "Imagem",    Icon: ImageIcon,  color: "#F59E0B" },
  { type: "engine", label: "Engine",   Icon: Zap,        color: "#8B5CF6" },
  { type: "result", label: "Resultado", Icon: Circle,     color: "#10B981" },
];

interface BottomBarProps {
  onAdd: (type: WorkflowNodeType) => void;
}

export function BottomBar({ onAdd }: BottomBarProps) {
  return (
    <div
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50"
      style={{ pointerEvents: "none" }}
    >
      <div
        className="flex items-center gap-0.5 px-1.5 py-1.5"
        style={{
          pointerEvents: "auto",
          background: "rgba(8,8,10,0.94)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 16,
          backdropFilter: "blur(20px)",
          boxShadow:
            "0 8px 40px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.04) inset",
        }}
      >
        {ITEMS.map(({ type, label, Icon, color }) => (
          <button
            key={type}
            onClick={() => onAdd(type)}
            className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-all"
            style={{ cursor: "pointer" }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = `${color}12`;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
            onMouseDown={e => {
              (e.currentTarget as HTMLElement).style.transform = "scale(0.94)";
            }}
            onMouseUp={e => {
              (e.currentTarget as HTMLElement).style.transform = "scale(1)";
            }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: `${color}15`, border: `1px solid ${color}20` }}
            >
              <Icon size={14} style={{ color }} />
            </div>
            <span
              style={{
                color: "rgba(255,255,255,0.4)",
                fontSize: 9,
                letterSpacing: "0.04em",
                fontWeight: 500,
              }}
            >
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
