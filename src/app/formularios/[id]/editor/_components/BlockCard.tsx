"use client";

import { Plus } from "lucide-react";
import type { BlockDefinition } from "./blocks";

interface BlockCardProps {
  block: BlockDefinition;
  onClick: () => void;
}

export function BlockCard({ block, onClick }: BlockCardProps) {
  const Icon = block.icon;

  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-all hover:bg-[var(--hover)]"
    >
      <div
        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ background: `${block.color}18` }}
      >
        <Icon size={14} style={{ color: block.color }} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate" style={{ color: "var(--text-title)" }}>
          {block.label}
        </p>
        <p className="text-[10px] truncate" style={{ color: "var(--muted-foreground)" }}>
          {block.description}
        </p>
      </div>

      <Plus
        size={13}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: "var(--muted-foreground)" }}
      />
    </button>
  );
}
