"use client";

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
} from "@dnd-kit/sortable";
import { Plus, Play, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FormStep, FormStepType, FormWelcomeScreen, FormEnding } from "@/types";
import { StepCard } from "./StepCard";

interface EditorCanvasProps {
  welcome: FormWelcomeScreen;
  steps: FormStep[];
  endings: FormEnding[];
  selectedId: string | null;
  onSelectWelcome: () => void;
  onSelectEnding: () => void;
  onSelectStep: (id: string) => void;
  onAddStep: (type: FormStepType) => void;
  onDeleteStep: (id: string) => void;
  onDuplicateStep: (id: string) => void;
  onReorderSteps: (steps: FormStep[]) => void;
  // Chamado quando o usuário clica "Adicionar pergunta" — permite o pai
  // abrir a biblioteca de blocos no painel esquerdo.
  onOpenBlockLibrary: () => void;
}

// ── Card especial (welcome / ending) ─────────────────────────────────────────

function SpecialCard({
  icon: Icon,
  label,
  description,
  color,
  isSelected,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  color: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={isSelected}
      aria-label={label}
      className="flex items-center gap-3 w-full px-3 py-3 rounded-xl border transition-all text-left"
      style={{
        background: isSelected ? `${color}10` : "var(--card)",
        borderColor: isSelected ? color : "var(--border)",
        boxShadow: isSelected ? `0 0 0 1px ${color}` : undefined,
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}20` }}
        aria-hidden="true"
      >
        <Icon size={14} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate" style={{ color: "var(--text-title)" }}>
          {label}
        </p>
        <p className="text-[10px] truncate" style={{ color: "var(--muted-foreground)" }}>
          {description}
        </p>
      </div>
    </button>
  );
}

// ── Canvas principal ──────────────────────────────────────────────────────────

export function EditorCanvas({
  welcome,
  steps,
  endings,
  selectedId,
  onSelectWelcome,
  onSelectEnding,
  onSelectStep,
  onAddStep,
  onDeleteStep,
  onDuplicateStep,
  onReorderSteps,
  onOpenBlockLibrary,
}: EditorCanvasProps) {
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

  return (
    <div className="flex flex-col items-center py-8 px-6 min-h-full gap-2">
      <div className="w-full max-w-sm flex flex-col gap-2">

        {/* Welcome */}
        <SpecialCard
          icon={Play}
          label="Tela de Boas-vindas"
          description={welcome.enabled ? welcome.title || "Configurar..." : "Desativada"}
          color="#22c55e"
          isSelected={selectedId === "welcome"}
          onClick={onSelectWelcome}
        />

        {/* Divisor */}
        {steps.length > 0 && (
          <div className="flex items-center gap-2 my-1">
            <div className="flex-1" style={{ height: "1px", background: "var(--border)" }} />
            <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
              {steps.length} pergunta{steps.length !== 1 ? "s" : ""}
            </span>
            <div className="flex-1" style={{ height: "1px", background: "var(--border)" }} />
          </div>
        )}

        {/* Steps sortáveis */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={steps.map(s => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-2" role="list" aria-label="Perguntas do formulário">
              {steps.map((step, idx) => (
                <StepCard
                  key={step.id}
                  step={step}
                  index={idx}
                  isSelected={selectedId === step.id}
                  onSelect={() => onSelectStep(step.id)}
                  onDelete={() => onDeleteStep(step.id)}
                  onDuplicate={() => onDuplicateStep(step.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Botão de adição — abre a biblioteca de blocos */}
        <button
          onClick={onOpenBlockLibrary}
          className={cn(
            "flex items-center justify-center gap-2 w-full py-3 rounded-xl border text-xs font-medium transition-all",
            "hover:bg-white/5 hover:border-white/20",
          )}
          style={{
            borderColor: "var(--border)",
            borderStyle: "dashed",
            color: "var(--muted-foreground)",
          }}
          aria-label="Abrir biblioteca de blocos para adicionar pergunta"
        >
          <Plus size={13} aria-hidden="true" />
          Adicionar pergunta
        </button>

        {/* Divisor */}
        <div className="flex items-center gap-2 my-1">
          <div className="flex-1" style={{ height: "1px", background: "var(--border)" }} />
        </div>

        {/* Ending */}
        <SpecialCard
          icon={Square}
          label="Tela de Encerramento"
          description={endings[0]?.title || "Configurar..."}
          color="#ef4444"
          isSelected={selectedId === "ending"}
          onClick={onSelectEnding}
        />
      </div>
    </div>
  );
}
