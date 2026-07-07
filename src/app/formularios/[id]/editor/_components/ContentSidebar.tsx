"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus, Play, Square, GripVertical, Trash2, Copy, GitBranch,
} from "lucide-react";
import type { FormStep, FormStepType, FormWelcomeScreen, FormEnding } from "@/types";
import { getBlockDef } from "./blocks";
import { AddContentModal } from "./AddContentModal";

interface ContentSidebarProps {
  steps: FormStep[];
  welcome: FormWelcomeScreen;
  endings: FormEnding[];
  logicCountByStep?: Record<string, number>;
  selectedId: string | null;
  onSelectWelcome: () => void;
  onSelectStep: (id: string) => void;
  onSelectEnding: () => void;
  onAddStep: (type: FormStepType) => void;
  onDeleteStep: (id: string) => void;
  onDuplicateStep: (id: string) => void;
  onReorderSteps: (steps: FormStep[]) => void;
}

// ── Item especial fixo (boas-vindas / encerramento) ───────────────────────────

function SpecialStructureItem({
  icon: Icon,
  label,
  subtitle,
  isSelected,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  subtitle: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={isSelected}
      className="flex items-center gap-2.5 w-full px-2 py-2 rounded-xl text-left transition-all"
      style={{
        background: isSelected ? "var(--glass-bg-soft)" : "transparent",
        border: `1px solid ${isSelected ? "var(--glass-border)" : "transparent"}`,
      }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: "var(--glass-bg-soft)" }}
        aria-hidden="true"
      >
        <Icon size={13} style={{ color: "var(--muted-foreground)" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-xs font-medium truncate"
          style={{ color: isSelected ? "var(--text-title)" : "var(--muted-foreground)" }}
        >
          {label}
        </p>
        <p className="text-[10px] truncate" style={{ color: "var(--muted-foreground)", opacity: 0.55 }}>
          {subtitle}
        </p>
      </div>
    </button>
  );
}

// ── Item de step (sortable com drag) ──────────────────────────────────────────

function SortableStepItem({
  step,
  index,
  isSelected,
  logicCount,
  onSelect,
  onDelete,
  onDuplicate,
}: {
  step: FormStep;
  index: number;
  isSelected: boolean;
  logicCount: number;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const def   = getBlockDef(step.type);
  const Icon  = def?.icon;
  const color = def?.color ?? "var(--muted-foreground)";

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      role="listitem"
    >
      <div
        onClick={onSelect}
        className="group flex items-center gap-1.5 px-2 py-2 rounded-xl cursor-pointer transition-all select-none"
        style={{
          background: isSelected ? "var(--glass-bg-soft)" : "transparent",
          border: `1px solid ${isSelected ? "var(--glass-border)" : "transparent"}`,
        }}
        role="button"
        aria-pressed={isSelected}
        aria-label={`Pergunta ${index + 1}: ${step.title || "Sem título"}`}
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); }
        }}
      >
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="flex-shrink-0 opacity-0 group-hover:opacity-35 cursor-grab active:cursor-grabbing transition-opacity"
          onClick={e => e.stopPropagation()}
          aria-label={`Arrastar pergunta ${index + 1}`}
        >
          <GripVertical size={12} style={{ color: "var(--muted-foreground)" }} aria-hidden="true" />
        </div>

        {/* Type icon */}
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}15`, color }}
          aria-hidden="true"
        >
          {Icon ? <Icon size={12} /> : <span className="text-[10px] font-bold">{index + 1}</span>}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p
            className="text-xs font-medium truncate"
            style={{ color: isSelected ? "var(--text-title)" : "var(--muted-foreground)" }}
          >
            {step.title || "Sem título"}
          </p>
          <p className="text-[10px] truncate" style={{ color: "var(--muted-foreground)", opacity: 0.55 }}>
            {def?.label ?? step.type}
          </p>
        </div>

        {/* Indicador de lógica condicional */}
        {logicCount > 0 && (
          <div
            className="flex-shrink-0"
            title={`Possui ${logicCount} regra${logicCount !== 1 ? "s" : ""} de navegação`}
            aria-label={`Possui ${logicCount} regra${logicCount !== 1 ? "s" : ""} de navegação`}
          >
            <GitBranch size={11} style={{ color: "#a78bfa" }} aria-hidden="true" />
          </div>
        )}

        {/* Hover actions */}
        <div
          className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={e => { e.stopPropagation(); onDuplicate(); }}
            className="p-1 rounded hover:bg-[var(--hover)] transition-colors"
            aria-label={`Duplicar pergunta ${index + 1}`}
            title="Duplicar"
          >
            <Copy size={10} style={{ color: "var(--muted-foreground)" }} aria-hidden="true" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="p-1 rounded hover:bg-red-500/10 transition-colors"
            aria-label={`Excluir pergunta ${index + 1}`}
            title="Excluir"
          >
            <Trash2 size={10} style={{ color: "#ef4444" }} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ContentSidebar ─────────────────────────────────────────────────────────────

export function ContentSidebar({
  steps,
  welcome,
  endings,
  logicCountByStep = {},
  selectedId,
  onSelectWelcome,
  onSelectStep,
  onSelectEnding,
  onAddStep,
  onDeleteStep,
  onDuplicateStep,
  onReorderSteps,
}: ContentSidebarProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = steps.findIndex(s => s.id === active.id);
    const newIdx = steps.findIndex(s => s.id === over.id);
    if (oldIdx !== -1 && newIdx !== -1) {
      onReorderSteps(arrayMove(steps, oldIdx, newIdx));
    }
  }

  const handleAddBlock = (type: FormStepType) => {
    onAddStep(type);
    setModalOpen(false);
  };

  return (
    <>
      <div
        className="w-60 flex-shrink-0 flex flex-col border-r overflow-hidden"
        style={{
          borderColor: "var(--glass-border)",
          background: "var(--hover)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-2.5 border-b flex-shrink-0"
          style={{ borderColor: "var(--glass-border)" }}
        >
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--muted-foreground)" }}
          >
            Conteúdo
          </span>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg transition-all hover:opacity-90 active:scale-95"
            style={{
              background: "color-mix(in srgb, var(--primary) 14%, transparent)",
              color: "var(--primary)",
              border: "1px solid color-mix(in srgb, var(--primary) 24%, transparent)",
            }}
            aria-label="Adicionar conteúdo"
          >
            <Plus size={11} aria-hidden="true" />
            Adicionar
          </button>
        </div>

        {/* Structure list */}
        <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-0.5">
          {/* Boas-vindas */}
          <SpecialStructureItem
            icon={Play}
            label="Boas-vindas"
            subtitle={welcome.enabled ? (welcome.title || "Configurar...") : "Desativada"}
            isSelected={selectedId === "welcome"}
            onClick={onSelectWelcome}
          />

          {/* Divisor + contagem de perguntas */}
          <div className="flex items-center gap-2 my-1.5 px-2">
            <div className="flex-1" style={{ height: "1px", background: "var(--glass-bg-soft)" }} />
            {steps.length > 0 && (
              <span
                className="text-[9px] uppercase tracking-wider"
                style={{ color: "var(--muted-foreground)", opacity: 0.45 }}
              >
                {steps.length} pergunta{steps.length !== 1 ? "s" : ""}
              </span>
            )}
            <div className="flex-1" style={{ height: "1px", background: "var(--glass-bg-soft)" }} />
          </div>

          {/* Lista sortável de steps */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={steps.map(s => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-0.5" role="list" aria-label="Perguntas do formulário">
                {steps.map((step, idx) => (
                  <SortableStepItem
                    key={step.id}
                    step={step}
                    index={idx}
                    isSelected={selectedId === step.id}
                    logicCount={logicCountByStep[step.id] ?? 0}
                    onSelect={() => onSelectStep(step.id)}
                    onDelete={() => onDeleteStep(step.id)}
                    onDuplicate={() => onDuplicateStep(step.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Empty hint */}
          {steps.length === 0 && (
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 text-xs py-2.5 px-3 rounded-xl transition-all hover:bg-[var(--hover)] w-full mt-1"
              style={{
                color: "var(--muted-foreground)",
                border: "1px dashed var(--glass-border)",
              }}
            >
              <Plus size={11} aria-hidden="true" />
              Adicionar primeira pergunta
            </button>
          )}

          {/* Divisor antes do encerramento */}
          <div className="flex items-center gap-2 my-1.5 px-2">
            <div className="flex-1" style={{ height: "1px", background: "var(--glass-bg-soft)" }} />
          </div>

          {/* Encerramento */}
          <SpecialStructureItem
            icon={Square}
            label="Encerramento"
            subtitle={endings[0]?.title || "Configurar..."}
            isSelected={selectedId === "ending"}
            onClick={onSelectEnding}
          />
        </div>

      </div>

      {/* Modal de adição */}
      <AddContentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={handleAddBlock}
      />
    </>
  );
}
