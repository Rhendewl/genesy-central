"use client";

import type { CSSProperties, ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type SortableApi = ReturnType<typeof useSortable>;

export interface SortableStageHandleProps {
  attributes:          SortableApi["attributes"];
  listeners:           SortableApi["listeners"];
  setActivatorNodeRef: SortableApi["setActivatorNodeRef"];
  isDragging:          boolean;
}

interface SortableStageCardProps {
  id:        string;
  cardStyle?: CSSProperties;
  children:  (handle: SortableStageHandleProps) => ReactNode;
}

export function SortableStageCard({ id, cardStyle, children }: SortableStageCardProps) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 180ms ease, opacity 180ms ease, box-shadow 180ms ease",
    opacity: isDragging ? 0.28 : 1,
    boxShadow: isDragging ? "inset 0 0 0 1px var(--primary), 0 0 0 1px var(--primary)" : undefined,
    ...cardStyle,
  };

  return (
    <div
      ref={setNodeRef}
      className="lc-card p-4 transition-[box-shadow,opacity,transform]"
      style={style}
    >
      {children({ attributes, listeners, setActivatorNodeRef, isDragging })}
    </div>
  );
}

interface StageDragOverlayPreviewProps {
  title: string;
  meta?: string;
  color?: string;
}

export function StageDragOverlayPreview({ title, meta, color = "var(--primary)" }: StageDragOverlayPreviewProps) {
  return (
    <div
      className="min-w-[260px] max-w-[420px] rounded-2xl px-4 py-3"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border-card-hover)",
        borderLeft: `3px solid ${color}`,
        boxShadow: "0 28px 70px var(--shadow-lg), 0 0 0 1px rgba(255,255,255,0.04)",
      }}
    >
      <p className="truncate text-sm font-semibold" style={{ color: "var(--text-title)" }}>
        {title}
      </p>
      {meta && (
        <p className="mt-1 truncate text-xs" style={{ color: "var(--muted-foreground)" }}>
          {meta}
        </p>
      )}
    </div>
  );
}
