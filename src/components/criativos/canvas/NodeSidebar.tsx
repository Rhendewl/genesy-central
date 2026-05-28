"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  MessageSquare, Building2, Upload, Palette, Image,
  PenLine, Heading, MousePointerClick, ImagePlus, Layers, LayoutDashboard,
  GitBranch, Shuffle, Filter,
  Eye, CheckCircle2, Download,
  ChevronDown,
} from "lucide-react";
import { NODES_BY_CATEGORY, CATEGORY_COLORS, type NodeMeta } from "../nodes/nodeRegistry";
import type { NodeCategory } from "@/lib/workflow/types";

const ICON_MAP: Record<string, LucideIcon> = {
  MessageSquare, Building2, Upload, Palette, Image,
  PenLine, Heading, MousePointerClick, ImagePlus, Layers, LayoutDashboard,
  GitBranch, Shuffle, Filter,
  Eye, CheckCircle2, Download,
};

const CATEGORY_LABELS: Record<NodeCategory, string> = {
  input:      "Entrada",
  ai:         "IA",
  processing: "Processamento",
  output:     "Saída",
};

const CATEGORY_ORDER: NodeCategory[] = ["input", "ai", "processing", "output"];

function NodeItem({ meta }: { meta: NodeMeta }) {
  const colors = CATEGORY_COLORS[meta.category];
  const IconComponent: LucideIcon | undefined = ICON_MAP[meta.icon];

  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/workflow-node-type", meta.type);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 cursor-grab active:cursor-grabbing transition-all select-none"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.background = colors.bg;
        (e.currentTarget as HTMLDivElement).style.borderColor = colors.border;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)";
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.06)";
      }}
    >
      <div
        className="flex items-center justify-center rounded w-5 h-5 shrink-0"
        style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
      >
        {IconComponent && <IconComponent size={10} style={{ color: colors.text }} />}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-xs leading-tight truncate" style={{ color: "rgba(255,255,255,0.8)", fontSize: 11 }}>
          {meta.label}
        </span>
        <span className="text-xs leading-tight truncate" style={{ color: "rgba(255,255,255,0.35)", fontSize: 9 }}>
          {meta.description}
        </span>
      </div>
    </div>
  );
}

function CategorySection({ category, nodes }: { category: NodeCategory; nodes: NodeMeta[] }) {
  const [open, setOpen] = useState(true);
  const colors = CATEGORY_COLORS[category];

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-2 py-1.5 transition-opacity hover:opacity-80"
      >
        <div className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: colors.primary }}
          />
          <span className="text-xs font-medium uppercase tracking-widest" style={{ color: colors.text, fontSize: 9 }}>
            {CATEGORY_LABELS[category]}
          </span>
        </div>
        <ChevronDown
          size={10}
          style={{ color: "rgba(255,255,255,0.3)", transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s" }}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-1 pb-2">
          {nodes.map(meta => <NodeItem key={meta.type} meta={meta} />)}
        </div>
      )}
    </div>
  );
}

export function NodeSidebar() {
  return (
    <aside
      className="flex flex-col h-full overflow-y-auto"
      style={{
        width: 200,
        background: "rgba(10,10,12,0.95)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="px-3 py-3 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)", fontSize: 9 }}>
          Nodes
        </span>
        <p className="mt-0.5" style={{ color: "rgba(255,255,255,0.25)", fontSize: 9 }}>
          Arraste para o canvas
        </p>
      </div>
      <div className="flex flex-col gap-0.5 p-2 flex-1">
        {CATEGORY_ORDER.map(cat => (
          <CategorySection key={cat} category={cat} nodes={NODES_BY_CATEGORY[cat]} />
        ))}
      </div>
    </aside>
  );
}
