"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ArrowLeft, ChevronDown, ChevronUp, Plus, X, GripVertical, FolderInput } from "lucide-react";
import { toast } from "sonner";
import { useCurrentMember } from "@/context/CurrentMemberContext";
import { useOnboardingTemplate } from "@/hooks/useOnboardingTemplate";
import { TemplateTaskModal } from "@/components/workspace/onboarding/TemplateTaskModal";
import { SortableStageCard, StageDragOverlayPreview } from "@/components/workspace/onboarding/SortableStageCard";
import { PriorityBadge } from "@/components/workspace/PriorityBadge";
import type { OnboardingTemplateTask } from "@/types/onboarding";

const COLOR_SWATCHES = ["#4a8fd4", "#6b9b6f", "#e0a344", "#e05c5c", "#9b7fe0", "#7c878e"];

export default function OnboardingTemplateBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { member, isLoading: isMemberLoading } = useCurrentMember();
  const {
    detail, isLoading,
    updateTemplate,
    refetch,
    addStage, updateStage, deleteStage,
    addTask, updateTask, deleteTask,
  } = useOnboardingTemplate(id);

  const [taskModal, setTaskModal] = useState<{ stageId: string; task: OnboardingTemplateTask | null } | null>(null);
  const [stageDelete, setStageDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingStage, setIsDeletingStage] = useState(false);
  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  const [stageOrder, setStageOrder] = useState<string[]>([]);

  const fetchedStageIdsKey = detail?.stages.map((stage) => stage.id).join("|") ?? "";

  useEffect(() => {
    if (!activeStageId) setStageOrder(fetchedStageIdsKey ? fetchedStageIdsKey.split("|") : []);
  }, [activeStageId, fetchedStageIdsKey]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (isMemberLoading) {
    return (
      <div className="flex justify-center px-4 py-24 sm:px-6">
        <div className="h-8 w-8 animate-pulse rounded-full" style={{ background: "var(--card)" }} />
      </div>
    );
  }

  if (member?.role !== "admin") {
    return (
      <div className="flex flex-col gap-4 px-4 py-6 sm:px-6">
        <button
          onClick={() => router.push("/workspace/onboarding")}
          className="flex w-fit items-center gap-1.5 text-sm"
          style={{ color: "var(--muted-foreground)" }}
        >
          <ArrowLeft size={15} />
          Onboarding
        </button>
        <div className="lc-card p-5">
          <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Acesso restrito</p>
          <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
            Apenas administradores podem editar templates de onboarding.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading || !detail) {
    return (
      <div className="flex flex-col gap-4 px-4 py-6 sm:px-6">
        <div className="h-8 w-48 animate-pulse rounded-lg" style={{ background: "var(--card)" }} />
        <div className="h-40 animate-pulse rounded-2xl" style={{ background: "var(--card)" }} />
      </div>
    );
  }

  const allTasks = detail.stages.flatMap((s) => s.tasks);

  async function handleAddStage() {
    const result = await addStage({ name: "Nova etapa" });
    if (result.error) toast.error(result.error);
  }

  async function handleDeleteStage() {
    if (!stageDelete) return;
    setIsDeletingStage(true);
    const result = await deleteStage(stageDelete.id);
    setIsDeletingStage(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setStageDelete(null);
  }

  function getCurrentStageIds() {
    if (!detail) return;
    const fetchedIds = detail.stages.map((stage) => stage.id);
    const preferredIds = stageOrder.length > 0 ? stageOrder : fetchedIds;
    return [
      ...preferredIds.filter((stageId) => fetchedIds.includes(stageId)),
      ...fetchedIds.filter((stageId) => !preferredIds.includes(stageId)),
    ];
  }

  async function persistStageOrder(orderedIds: string[]) {
    if (!detail) return;
    setStageOrder(orderedIds);

    const currentById = new Map(detail.stages.map((stage) => [stage.id, stage]));
    const results = await Promise.all(orderedIds.map(async (stageId, index) => {
      const stage = currentById.get(stageId);
      if (!stage || stage.order_index === index) return { ok: true, error: null as string | null };

      const res = await fetch(`/api/workspace/onboarding/templates/${id}/stages/${stageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_index: index }),
      });
      const json = await res.json().catch(() => ({})) as { error?: string };
      return { ok: res.ok, error: json.error ?? "Erro ao reordenar etapa" };
    }));

    const failed = results.find((result) => !result.ok);
    if (failed) {
      toast.error(failed.error ?? "Erro ao reordenar etapa");
      setStageOrder(detail.stages.map((stage) => stage.id));
      return;
    }

    await refetch();
  }

  async function moveStage(stageIndex: number, direction: -1 | 1) {
    const ids = getCurrentStageIds();
    if (!ids) return;
    const targetIndex = stageIndex + direction;
    if (targetIndex < 0 || targetIndex >= ids.length) return;
    await persistStageOrder(arrayMove(ids, stageIndex, targetIndex));
  }

  function handleStageDragStart(event: DragStartEvent) {
    setActiveStageId(String(event.active.id));
  }

  function handleStageDragEnd(event: DragEndEvent) {
    const ids = getCurrentStageIds();
    setActiveStageId(null);
    if (!ids || !event.over || event.active.id === event.over.id) return;

    const oldIndex = ids.indexOf(String(event.active.id));
    const newIndex = ids.indexOf(String(event.over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    void persistStageOrder(arrayMove(ids, oldIndex, newIndex));
  }

  function handleStageDragCancel() {
    setActiveStageId(null);
  }

  async function moveTask(stageId: string, taskIndex: number, direction: -1 | 1) {
    if (!detail) return;
    const stage = detail.stages.find((s) => s.id === stageId);
    const current = stage?.tasks[taskIndex];
    const target = stage?.tasks[taskIndex + direction];
    if (!current || !target) return;

    const first = await updateTask(current.id, { order_index: target.order_index });
    if (first.error) {
      toast.error(first.error);
      return;
    }
    const second = await updateTask(target.id, { order_index: current.order_index });
    if (second.error) toast.error(second.error);
  }

  const orderedStageIds = getCurrentStageIds() ?? [];
  const stageById = new Map(detail.stages.map((stage) => [stage.id, stage]));
  const orderedStages = orderedStageIds
    .map((stageId) => stageById.get(stageId))
    .filter((stage): stage is NonNullable<typeof stage> => Boolean(stage));
  const activeStage = activeStageId ? stageById.get(activeStageId) : null;

  return (
    <div className="flex flex-col gap-6 px-4 pb-24 pt-4 sm:px-6">
      <button
        onClick={() => router.push("/workspace/onboarding/templates")}
        className="flex w-fit items-center gap-1.5 text-sm"
        style={{ color: "var(--muted-foreground)" }}
      >
        <ArrowLeft size={15} />
        Templates
      </button>

      <div className="flex flex-col gap-3 lc-card p-4">
        <input
          defaultValue={detail.name}
          onBlur={(e) => { if (e.target.value.trim() && e.target.value !== detail.name) void updateTemplate({ name: e.target.value.trim() }); }}
          className="bg-transparent text-lg font-bold outline-none"
          style={{ color: "var(--text-title)" }}
        />
        <textarea
          defaultValue={detail.description ?? ""}
          onBlur={(e) => { if (e.target.value !== (detail.description ?? "")) void updateTemplate({ description: e.target.value }); }}
          placeholder="Descrição do processo..."
          rows={2}
          className="resize-none bg-transparent text-sm outline-none placeholder:text-[var(--muted-foreground)]"
          style={{ color: "var(--muted-foreground)" }}
        />
        <label className="flex w-fit items-center gap-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
          <input type="checkbox" checked={detail.is_active} onChange={(e) => void updateTemplate({ is_active: e.target.checked })} />
          Template ativo (disponível para iniciar novos onboardings)
        </label>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleStageDragStart}
        onDragEnd={handleStageDragEnd}
        onDragCancel={handleStageDragCancel}
      >
        <SortableContext items={orderedStageIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-4">
            {orderedStages.map((stage, stageIdx) => (
              <SortableStageCard key={stage.id} id={stage.id}>
                {({ attributes, listeners, setActivatorNodeRef }) => (
                  <>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <button
                        ref={setActivatorNodeRef}
                        className="cursor-grab touch-none select-none rounded p-1 active:cursor-grabbing"
                        aria-label="Arrastar etapa para reordenar"
                        title="Arrastar etapa"
                        {...attributes}
                        {...listeners}
                      >
                        <GripVertical size={14} style={{ color: "var(--muted-foreground)" }} />
                      </button>
                      <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>{stageIdx + 1}.</span>
                      <input
                        defaultValue={stage.name}
                        onBlur={(e) => { if (e.target.value.trim() && e.target.value !== stage.name) void updateStage(stage.id, { name: e.target.value.trim() }); }}
                        className="flex-1 min-w-[140px] bg-transparent text-sm font-semibold outline-none"
                        style={{ color: "var(--text-title)" }}
                      />
                      <div className="flex items-center gap-1">
                        {COLOR_SWATCHES.map((c) => (
                          <button
                            key={c}
                            onClick={() => void updateStage(stage.id, { color: c })}
                            className="h-4 w-4 rounded-full transition-transform"
                            style={{ background: c, transform: stage.color === c ? "scale(1.25)" : "scale(1)" }}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
                        <span>Prazo: dia</span>
                        <input
                          type="number"
                          min={0}
                          defaultValue={stage.relative_due_days}
                          onBlur={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v) && v !== stage.relative_due_days) void updateStage(stage.id, { relative_due_days: v }); }}
                          className="w-14 rounded px-1.5 py-0.5 text-xs outline-none"
                          style={{ background: "var(--hover)", border: "1px solid var(--glass-border)", color: "var(--text-title)" }}
                        />
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => void moveStage(stageIdx, -1)}
                          disabled={stageIdx === 0}
                          className="rounded p-1 disabled:opacity-30"
                          aria-label="Mover etapa para cima"
                        >
                          <ChevronUp size={14} style={{ color: "var(--muted-foreground)" }} />
                        </button>
                        <button
                          onClick={() => void moveStage(stageIdx, 1)}
                          disabled={stageIdx === orderedStages.length - 1}
                          className="rounded p-1 disabled:opacity-30"
                          aria-label="Mover etapa para baixo"
                        >
                          <ChevronDown size={14} style={{ color: "var(--muted-foreground)" }} />
                        </button>
                      </div>
                      <button
                        onClick={() => setStageDelete({ id: stage.id, name: stage.name })}
                        className="rounded p-1 hover:bg-red-500/10"
                        aria-label="Excluir etapa"
                      >
                        <X size={14} style={{ color: "#e05c5c" }} />
                      </button>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {stage.tasks.map((task, taskIdx) => (
                        <div
                          key={task.id}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-[var(--hover)]"
                        >
                          <button
                            onClick={() => setTaskModal({ stageId: stage.id, task })}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            <span className="flex-1 truncate text-sm" style={{ color: "var(--text-title)" }}>{task.title}</span>
                            {task.assignee_name && (
                              <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: "var(--hover)", color: "var(--muted-foreground)" }}>
                                {task.assignee_name}
                              </span>
                            )}
                            <PriorityBadge priority={task.priority} />
                            {(task.depends_on_task_ids?.length ?? 0) > 0 && (
                              <span className="flex items-center gap-0.5 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                                <FolderInput size={11} />{task.depends_on_task_ids!.length}
                              </span>
                            )}
                          </button>
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => void moveTask(stage.id, taskIdx, -1)}
                              disabled={taskIdx === 0}
                              className="rounded p-1 disabled:opacity-30"
                              aria-label="Mover tarefa para cima"
                            >
                              <ChevronUp size={13} style={{ color: "var(--muted-foreground)" }} />
                            </button>
                            <button
                              onClick={() => void moveTask(stage.id, taskIdx, 1)}
                              disabled={taskIdx === stage.tasks.length - 1}
                              className="rounded p-1 disabled:opacity-30"
                              aria-label="Mover tarefa para baixo"
                            >
                              <ChevronDown size={13} style={{ color: "var(--muted-foreground)" }} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => setTaskModal({ stageId: stage.id, task: null })}
                      className="mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      <Plus size={13} />
                      Nova tarefa
                    </button>
                  </>
                )}
              </SortableStageCard>
            ))}

            <button
              onClick={handleAddStage}
              className="flex items-center justify-center gap-2 rounded-2xl py-3 text-sm"
              style={{ border: "1px dashed var(--glass-border)", color: "var(--muted-foreground)" }}
            >
              <Plus size={15} />
              Nova etapa
            </button>
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={{ duration: 180, easing: "ease" }}>
          {activeStage ? (
            <div style={{ transform: "rotate(1deg)" }}>
              <StageDragOverlayPreview
                title={activeStage.name}
                meta={`${activeStage.tasks.length} tarefa${activeStage.tasks.length === 1 ? "" : "s"}`}
                color={activeStage.color}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {taskModal && (
        <TemplateTaskModal
          task={taskModal.task}
          otherTasks={allTasks.filter((t) => t.id !== taskModal.task?.id)}
          onClose={() => setTaskModal(null)}
          onSave={async (data) => {
            const result = taskModal.task
              ? await updateTask(taskModal.task.id, data)
              : await addTask(taskModal.stageId, data);
            return result;
          }}
          onDelete={taskModal.task ? async () => {
            const result = await deleteTask(taskModal.task!.id);
            if (result.error) toast.error(result.error);
            else setTaskModal(null);
          } : undefined}
        />
      )}

      {stageDelete && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 lc-scrim"
          style={{ background: "rgba(0,0,0,0.60)", backdropFilter: "blur(6px)" }}
          onClick={() => setStageDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl"
            style={{ background: "var(--bg-modal)", border: "1px solid var(--border-modal)", boxShadow: "0 24px 64px var(--shadow-modal)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pb-3 pt-5">
              <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Excluir etapa?</p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                A etapa <span className="font-medium">{stageDelete.name}</span> será removida junto com as tarefas dela.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4" style={{ borderTop: "1px solid var(--glass-border)" }}>
              <button
                onClick={() => setStageDelete(null)}
                className="rounded-full px-4 py-1.5 text-xs"
                style={{ background: "var(--hover)", color: "var(--muted-foreground)", border: "1px solid var(--glass-border)" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteStage}
                disabled={isDeletingStage}
                className="rounded-full px-4 py-1.5 text-xs font-medium disabled:opacity-40"
                style={{ background: "#e05c5c18", color: "#ff6b6b", border: "1px solid #e05c5c35" }}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
