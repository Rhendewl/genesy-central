"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FormStep } from "@/types";
import { getBlockDef } from "./blocks";

interface StepCardProps {
  step: FormStep;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export function StepCard({
  step,
  index,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
}: StepCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const def   = getBlockDef(step.type);
  const Icon  = def?.icon;
  const color = def?.color ?? "var(--muted-foreground)";

  return (
    <div ref={setNodeRef} style={dragStyle} role="listitem">
      <div
        onClick={onSelect}
        className={cn(
          "group flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-all select-none",
        )}
        style={{
          background: isSelected ? `${color}12` : "var(--card)",
          borderColor: isSelected ? color : "var(--border)",
          boxShadow: isSelected ? `0 0 0 1px ${color}` : undefined,
        }}
        role="button"
        aria-pressed={isSelected}
        aria-label={`Pergunta ${index + 1}: ${step.title || "Sem título"}`}
        tabIndex={0}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
      >
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="flex-shrink-0 opacity-0 group-hover:opacity-60 cursor-grab active:cursor-grabbing transition-opacity"
          style={{ color: "var(--muted-foreground)" }}
          onClick={e => e.stopPropagation()}
          aria-label={`Arrastar pergunta ${index + 1}`}
          title="Arrastar para reordenar"
        >
          <GripVertical size={13} aria-hidden="true" />
        </div>

        {/* Número + ícone */}
        <div
          className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold"
          style={{ background: `${color}20`, color }}
          aria-hidden="true"
        >
          {Icon ? <Icon size={11} /> : index + 1}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: "var(--text-title)" }}>
            {step.title || "Sem título"}
          </p>
          <p className="text-[10px] truncate" style={{ color: "var(--muted-foreground)" }}>
            {def?.label ?? step.type}
            {step.required && " · Obrigatório"}
          </p>
        </div>

        {/* Ações */}
        <div
          className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={e => { e.stopPropagation(); onDuplicate(); }}
            className="p-1 rounded transition-colors hover:bg-white/10"
            aria-label={`Duplicar pergunta ${index + 1}`}
            title="Duplicar"
          >
            <Copy size={11} style={{ color: "var(--muted-foreground)" }} aria-hidden="true" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="p-1 rounded transition-colors hover:bg-red-500/10"
            aria-label={`Excluir pergunta ${index + 1}`}
            title="Excluir"
          >
            <Trash2 size={11} style={{ color: "#ef4444" }} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
