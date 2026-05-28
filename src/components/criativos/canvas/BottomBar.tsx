"use client";

import { motion } from "framer-motion";
import { Type, ImageIcon, Zap, Sparkles } from "lucide-react";
import type { WorkflowNodeType } from "@/lib/workflow/types";

const ITEMS: Array<{
  type: WorkflowNodeType;
  label: string;
  Icon: React.ElementType;
  color: string;
  glow: string;
}> = [
  { type: "text",   label: "Texto",     Icon: Type,      color: "#3B82F6", glow: "rgba(59,130,246,0.35)"  },
  { type: "media",  label: "Mídia",     Icon: ImageIcon, color: "#F59E0B", glow: "rgba(245,158,11,0.35)"  },
  { type: "engine", label: "Engine",    Icon: Zap,       color: "#8B5CF6", glow: "rgba(139,92,246,0.35)"  },
  { type: "result", label: "Resultado", Icon: Sparkles,  color: "#10B981", glow: "rgba(16,185,129,0.35)"  },
];

interface BottomBarProps {
  onAdd: (type: WorkflowNodeType) => void;
}

export function BottomBar({ onAdd }: BottomBarProps) {
  return (
    <div
      className="absolute bottom-7 left-1/2 -translate-x-1/2 z-50"
      style={{ pointerEvents: "none" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{
          pointerEvents: "auto",
          display: "flex",
          alignItems: "center",
          gap: 2,
          padding: "6px 8px",
          background: "rgba(5, 5, 9, 0.80)",
          backdropFilter: "blur(40px) saturate(2)",
          WebkitBackdropFilter: "blur(40px) saturate(2)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 22,
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.04), " +
            "0 32px 80px rgba(0,0,0,0.85), " +
            "0 4px 16px rgba(0,0,0,0.55), " +
            "inset 0 1px 0 rgba(255,255,255,0.07), " +
            "inset 0 -1px 0 rgba(0,0,0,0.4)",
        }}
      >
        {ITEMS.map(({ type, label, Icon, color, glow }, i) => (
          <DockItem
            key={type}
            type={type}
            label={label}
            Icon={Icon}
            color={color}
            glow={glow}
            index={i}
            onAdd={onAdd}
          />
        ))}
      </motion.div>
    </div>
  );
}

function DockItem({
  type, label, Icon, color, glow, index, onAdd,
}: {
  type: WorkflowNodeType;
  label: string;
  Icon: React.ElementType;
  color: string;
  glow: string;
  index: number;
  onAdd: (type: WorkflowNodeType) => void;
}) {
  return (
    <motion.button
      onClick={() => onAdd(type)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 * index, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ scale: 1.1, y: -4 }}
      whileTap={{ scale: 0.91 }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 5,
        padding: "8px 16px",
        borderRadius: 16,
        cursor: "pointer",
        border: "none",
        background: "transparent",
        position: "relative",
      }}
      onHoverStart={e => {
        const el = (e.target as HTMLElement).closest("button");
        if (el) el.style.background = `${color}10`;
      }}
      onHoverEnd={e => {
        const el = (e.target as HTMLElement).closest("button");
        if (el) el.style.background = "transparent";
      }}
    >
      {/* Icon container */}
      <motion.div
        whileHover={{
          boxShadow: `0 0 20px ${glow}, 0 0 8px ${glow}`,
        }}
        transition={{ duration: 0.2 }}
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `${color}14`,
          border: `1px solid ${color}25`,
          boxShadow: `0 0 12px ${color}10, inset 0 1px 0 ${color}15`,
          transition: "background 0.2s, border-color 0.2s",
        }}
      >
        <Icon size={15} style={{ color, filter: `drop-shadow(0 0 4px ${glow})` }} />
      </motion.div>

      {/* Label */}
      <span
        style={{
          color: "rgba(255,255,255,0.38)",
          fontSize: 9,
          fontWeight: 500,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </motion.button>
  );
}
