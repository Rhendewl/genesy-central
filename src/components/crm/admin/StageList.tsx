"use client";

import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Plus, AlertCircle, Trash2, Loader2 } from "lucide-react";
import type { CrmStage, UpdateCrmStage } from "@/types/crm";
import { StageFormModal } from "./StageFormModal";

// ── Resultado de uma tentativa de exclusão de etapa ───────────────────────────
export interface DeleteStageResult {
  ok:          boolean;
  needsForce?: boolean;
  leadCount?:  number;
  error?:      string;
}

// ── Controle de exclusão (idle → armado → precisa de force → excluindo) ──────
// Isolado num componente próprio porque cada linha tem seu estado independente.
function DeleteStageControl({
  stage,
  onDelete,
}: {
  stage:    CrmStage;
  onDelete: (stage: CrmStage, force?: boolean) => Promise<DeleteStageResult>;
}) {
  const [state,     setState]     = useState<"idle" | "armed" | "needsForce" | "deleting">("idle");
  const [leadCount, setLeadCount] = useState(0);

  async function confirm() {
    setState("deleting");
    const result = await onDelete(stage, false);
    if (result.ok) return; // linha some da lista via refetch
    if (result.needsForce) {
      setLeadCount(result.leadCount ?? 0);
      setState("needsForce");
    } else {
      setState("idle");
    }
  }

  async function confirmForce() {
    setState("deleting");
    await onDelete(stage, true);
    setState("idle");
  }

  if (state === "deleting") {
    return <Loader2 size={12} className="animate-spin flex-shrink-0" style={{ color: "var(--muted-foreground)" }} />;
  }

  if (state === "armed") {
    return (
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-[10px] whitespace-nowrap" style={{ color: "#ef4444" }}>Excluir etapa?</span>
        <button type="button" onClick={() => setState("idle")} className="text-[10px] px-1.5 py-0.5 rounded hover:bg-[var(--hover)]" style={{ color: "var(--muted-foreground)" }}>
          Não
        </button>
        <button type="button" onClick={() => void confirm()} className="text-[10px] px-1.5 py-0.5 rounded font-medium hover:bg-red-500/10" style={{ color: "#ef4444" }}>
          Sim
        </button>
      </div>
    );
  }

  if (state === "needsForce") {
    return (
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-[10px] whitespace-nowrap" style={{ color: "#ef4444" }}>
          {leadCount} lead{leadCount !== 1 ? "s" : ""} ficará{leadCount !== 1 ? "ão" : ""} sem etapa
        </span>
        <button type="button" onClick={() => setState("idle")} className="text-[10px] px-1.5 py-0.5 rounded hover:bg-[var(--hover)]" style={{ color: "var(--muted-foreground)" }}>
          Cancelar
        </button>
        <button type="button" onClick={() => void confirmForce()} className="text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap hover:bg-red-500/10" style={{ color: "#ef4444" }}>
          Excluir mesmo assim
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setState("armed")}
      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10 flex-shrink-0"
      style={{ color: "var(--muted-foreground)" }}
      title="Excluir etapa"
    >
      <Trash2 size={12} />
    </button>
  );
}

// ── Sortable stage row ────────────────────────────────────────────────────────

function SortableStageRow({
  stage,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  stage:          CrmStage;
  onEdit:         (s: CrmStage) => void;
  onToggleActive: (s: CrmStage) => void;
  onDelete:       (s: CrmStage, force?: boolean) => Promise<DeleteStageResult>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stage.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-4 py-3 group"
      {...attributes}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none opacity-30 group-hover:opacity-70 transition-opacity"
        style={{ color: "var(--muted-foreground)" }}
        {...listeners}
        aria-label="Arrastar para reordenar"
      >
        <GripVertical size={14} />
      </button>

      {/* Color dot */}
      <span
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ background: stage.color }}
      />

      {/* Name + badges */}
      <div className="flex-1 min-w-0">
        <p
          className="text-xs font-medium truncate"
          style={{ color: stage.is_active ? "var(--text-title)" : "var(--muted-foreground)" }}
        >
          {stage.name}
        </p>
        {(stage.require_note || stage.require_attachment) && (
          <div className="flex items-center gap-2 mt-0.5">
            {stage.require_note && (
              <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>exige nota</span>
            )}
            {stage.require_attachment && (
              <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>exige anexo</span>
            )}
          </div>
        )}
      </div>

      {/* Active toggle */}
      <button
        type="button"
        role="switch"
        aria-checked={stage.is_active}
        onClick={() => onToggleActive(stage)}
        className="relative flex-shrink-0 w-8 h-4 rounded-full transition-colors"
        style={{ background: stage.is_active ? "var(--primary)" : "var(--border-card-hover)" }}
        title={stage.is_active ? "Desativar etapa" : "Ativar etapa"}
      >
        <span
          className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform"
          style={{ transform: stage.is_active ? "translateX(16px)" : "translateX(0)" }}
        />
      </button>

      {/* Edit */}
      <button
        type="button"
        onClick={() => onEdit(stage)}
        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--hover)]"
        style={{ color: "var(--muted-foreground)" }}
        title="Editar etapa"
      >
        <Pencil size={12} />
      </button>

      {/* Excluir */}
      <DeleteStageControl stage={stage} onDelete={onDelete} />
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  pipelineId: string;
  stages:     CrmStage[];
  onReorder:  (pipelineId: string, orderedIds: string[]) => Promise<void>;
  onUpdate:   (pipelineId: string, stageId: string, data: UpdateCrmStage) => Promise<boolean>;
  onCreate:   (pipelineId: string, data: { name: string } & UpdateCrmStage) => Promise<boolean>;
  onDelete:   (pipelineId: string, stageId: string, force?: boolean) => Promise<DeleteStageResult>;
}

// ── StageList ─────────────────────────────────────────────────────────────────

export function StageList({ pipelineId, stages, onReorder, onUpdate, onCreate, onDelete }: Props) {
  const [editingStage, setEditingStage] = useState<CrmStage | null>(null);
  const [isModalOpen,  setIsModalOpen]  = useState(false);
  const [isCreating,   setIsCreating]   = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activeStages   = stages.filter(s => s.is_active);
  const inactiveStages = stages.filter(s => !s.is_active);
  // Reorder operates only on active stages (they have contiguous order_index).
  const activeIds = activeStages.map(s => s.id);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = activeIds.indexOf(String(active.id));
    const newIndex = activeIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(activeIds, oldIndex, newIndex);
    void onReorder(pipelineId, newOrder);
  }

  function openCreate() {
    setEditingStage(null);
    setIsCreating(true);
    setIsModalOpen(true);
  }

  function openEdit(stage: CrmStage) {
    setEditingStage(stage);
    setIsCreating(false);
    setIsModalOpen(true);
  }

  async function handleToggleActive(stage: CrmStage) {
    await onUpdate(pipelineId, stage.id, { is_active: !stage.is_active });
  }

  function handleDeleteStage(stage: CrmStage, force?: boolean) {
    return onDelete(pipelineId, stage.id, force);
  }

  async function handleSave(data: { name: string } & UpdateCrmStage): Promise<boolean> {
    if (isCreating) {
      const maxOrder = stages.reduce((m, s) => Math.max(m, s.order_index), -1);
      return onCreate(pipelineId, { ...data, order_index: maxOrder + 1 });
    }
    if (!editingStage) return false;
    return onUpdate(pipelineId, editingStage.id, data);
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={activeIds} strategy={verticalListSortingStrategy}>
          <div className="divide-y" style={{ borderColor: "var(--border-card)" }}>
            {activeStages.length === 0 && (
              <div className="flex items-center gap-2 px-4 py-4" style={{ color: "var(--muted-foreground)" }}>
                <AlertCircle size={13} />
                <span className="text-xs">Nenhuma etapa ativa. Adicione uma etapa abaixo.</span>
              </div>
            )}
            {activeStages.map(stage => (
              <SortableStageRow
                key={stage.id}
                stage={stage}
                onEdit={openEdit}
                onToggleActive={handleToggleActive}
                onDelete={handleDeleteStage}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Inactive stages */}
      {inactiveStages.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border-card)" }}>
          <p className="px-4 py-2 text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
            Inativas
          </p>
          {inactiveStages.map(stage => (
            <div key={stage.id} className="flex items-center gap-3 px-4 py-3 group opacity-50">
              <GripVertical size={14} className="flex-shrink-0" style={{ color: "var(--muted-foreground)" }} />
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: stage.color }} />
              <p className="flex-1 text-xs truncate" style={{ color: "var(--muted-foreground)" }}>{stage.name}</p>
              <button
                type="button"
                role="switch"
                aria-checked={false}
                onClick={() => handleToggleActive(stage)}
                className="relative flex-shrink-0 w-8 h-4 rounded-full transition-colors"
                style={{ background: "var(--border-card-hover)" }}
                title="Ativar etapa"
              >
                <span className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white" />
              </button>
              <button
                type="button"
                onClick={() => openEdit(stage)}
                className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--hover)]"
                style={{ color: "var(--muted-foreground)" }}
              >
                <Pencil size={12} />
              </button>
              <DeleteStageControl stage={stage} onDelete={handleDeleteStage} />
            </div>
          ))}
        </div>
      )}

      {/* Add stage button */}
      <div style={{ borderTop: "1px solid var(--border-card)" }}>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 w-full px-4 py-3 text-xs font-medium hover:bg-[var(--hover)] transition-colors"
          style={{ color: "var(--primary)" }}
        >
          <Plus size={13} />
          Adicionar etapa
        </button>
      </div>

      <StageFormModal
        open={isModalOpen}
        stage={editingStage}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
      />
    </>
  );
}
