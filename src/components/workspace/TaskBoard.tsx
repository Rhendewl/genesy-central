"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  KeyboardSensor, PointerSensor, closestCorners, pointerWithin, useSensor, useSensors,
  type CollisionDetection,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { TaskColumn } from "./TaskColumn";
import { TaskCard } from "./TaskCard";
import { TaskTrashDropZone, WORKSPACE_TASK_TRASH_ID } from "./TaskTrashDropZone";
import { TaskCompletionCelebration } from "./TaskCompletionCelebration";
import { WORKSPACE_TASK_STATUSES, type WorkspaceTask, type WorkspaceTaskStatus } from "@/types/workspace";
import type { useWorkspaceTasks } from "@/hooks/useWorkspaceTasks";

interface TaskBoardProps {
  tasksHook:  ReturnType<typeof useWorkspaceTasks>;
  onOpenTask: (taskId: string) => void;
  visibleTasks?: WorkspaceTask[];
}

// O ponteiro é a fonte de verdade para movimentos com mouse/toque. O antigo
// closestCorners considerava o retângulo inteiro do overlay e podia escolher a
// lixeira à direita mesmo com o cursor ainda dentro da coluna "Concluído".
// Para teclado (sem coordenadas de ponteiro), mantemos o fallback acessível.
const taskCollisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  return pointerHits.length > 0 ? pointerHits : closestCorners(args);
};

export function TaskBoard({ tasksHook, onOpenTask, visibleTasks }: TaskBoardProps) {
  const {
    tasksByStatus, getTaskById, moveTask, canEditTask, canExecuteTask,
    discardTask, restoreDiscardedTask, commitDiscardedTask,
  } = tasksHook;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeCardWidth, setActiveCardWidth] = useState<number | null>(null);
  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const visibleTasksByStatus = useMemo(() => {
    if (!visibleTasks) return tasksByStatus;
    const grouped = { a_fazer: [], em_andamento: [], aguardando: [], concluido: [] } as Record<WorkspaceTaskStatus, WorkspaceTask[]>;
    visibleTasks.forEach((task) => grouped[task.status].push(task));
    return grouped;
  }, [tasksByStatus, visibleTasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setActiveCardWidth(event.active.rect.current.initial?.width ?? null);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      setActiveCardWidth(null);
      if (!over) return;

      const taskId = active.id as string;
      const draggedTask = getTaskById(taskId);
      if (!draggedTask) return;
      if (!canExecuteTask(draggedTask)) {
        toast.error("Somente o criador ou um responsável pode mover esta tarefa");
        return;
      }

      const overId = over.id as string;
      if (overId === WORKSPACE_TASK_TRASH_ID) {
        const result = discardTask(taskId);
        if (result.error || !result.discarded) {
          toast.error(result.error ?? "Erro ao descartar tarefa");
          return;
        }

        const { task, index } = result.discarded;
        const commitTimer = window.setTimeout(() => {
          void commitDiscardedTask(task, index).then((commitResult) => {
            if (commitResult.error) toast.error(commitResult.error);
          });
        }, 4000);

        toast.success("Tarefa descartada", {
          duration: 4000,
          action: {
            label: "Desfazer",
            onClick: () => {
              window.clearTimeout(commitTimer);
              restoreDiscardedTask(task, index);
            },
          },
        });
        return;
      }

      const isStatusId = WORKSPACE_TASK_STATUSES.some((s) => s.id === overId);

      let targetStatus: WorkspaceTaskStatus;
      let overTaskId: string | null = null;

      if (isStatusId) {
        targetStatus = overId as WorkspaceTaskStatus;
      } else {
        const overTask = getTaskById(overId);
        if (!overTask) return;
        targetStatus = overTask.status;
        overTaskId = overId;
      }

      const currentColumn = tasksByStatus[targetStatus].filter((t) => t.id !== taskId).map((t) => t.id);
      let insertIndex = currentColumn.length;
      if (overTaskId) {
        const idx = currentColumn.indexOf(overTaskId);
        if (idx !== -1) insertIndex = idx;
      }
      const orderedIds = [...currentColumn.slice(0, insertIndex), taskId, ...currentColumn.slice(insertIndex)];

      if (draggedTask.status === targetStatus) {
        const originalOrder = tasksByStatus[targetStatus].map((t) => t.id);
        if (originalOrder.join(",") === orderedIds.join(",")) return;
      }

      const result = await moveTask(taskId, targetStatus, orderedIds);
      if (result.error) toast.error(result.error);
    },
    [canExecuteTask, commitDiscardedTask, discardTask, getTaskById, moveTask, restoreDiscardedTask, tasksByStatus]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setActiveCardWidth(null);
  }, []);

  const handleBoardWheelCapture = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const scrollArea = boardScrollRef.current;
    if (!scrollArea || scrollArea.scrollWidth <= scrollArea.clientWidth) return;

    const absX = Math.abs(event.deltaX);
    const absY = Math.abs(event.deltaY);
    const isHorizontalGesture = absX > 0 && absX >= absY;
    const isShiftWheel = event.shiftKey && absY > 0;
    if (!isHorizontalGesture && !isShiftWheel) return;

    event.preventDefault();
    event.stopPropagation();
    scrollArea.scrollLeft += isShiftWheel ? event.deltaY : event.deltaX;
  }, []);

  const activeTask = activeId ? getTaskById(activeId) : null;

  return (
    <>
    <TaskCompletionCelebration celebrationId={tasksHook.completionCelebrationId} />
    <DndContext
      sensors={sensors}
      collisionDetection={taskCollisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        ref={boardScrollRef}
        onWheelCapture={handleBoardWheelCapture}
        className="-mx-4 overflow-x-auto overscroll-x-contain px-4 pb-4 [scrollbar-width:thin] sm:-mx-6 sm:px-6"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="flex w-max items-start gap-4 pr-10" style={{ scrollSnapType: "x mandatory" }}>
          {WORKSPACE_TASK_STATUSES.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.06, ease: "easeOut" }}
              style={{ scrollSnapAlign: "start" }}
              className="flex-shrink-0"
            >
              <TaskColumn
                status={s.id}
                label={s.label}
                tasks={visibleTasksByStatus[s.id]}
                onOpenTask={onOpenTask}
                canMoveTask={canExecuteTask}
              />
            </motion.div>
          ))}

          <TaskTrashDropZone />
        </div>
      </div>

      <DragOverlay adjustScale={false} dropAnimation={null}>
        {activeTask ? (
          <div style={{ width: activeCardWidth ?? undefined, transform: "rotate(1deg)", transformOrigin: "center" }}>
            <TaskCard task={activeTask} isDragOverlay canDrag={false} onClick={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
    </>
  );
}
