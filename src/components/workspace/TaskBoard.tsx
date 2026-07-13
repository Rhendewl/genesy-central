"use client";

import { useCallback, useState } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  KeyboardSensor, PointerSensor, closestCorners, useSensor, useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { TaskColumn } from "./TaskColumn";
import { TaskCard } from "./TaskCard";
import { TaskTrashDropZone, WORKSPACE_TASK_TRASH_ID } from "./TaskTrashDropZone";
import { WORKSPACE_TASK_STATUSES, type WorkspaceTaskStatus } from "@/types/workspace";
import type { useWorkspaceTasks } from "@/hooks/useWorkspaceTasks";

interface TaskBoardProps {
  tasksHook:  ReturnType<typeof useWorkspaceTasks>;
  onOpenTask: (taskId: string) => void;
}

export function TaskBoard({ tasksHook, onOpenTask }: TaskBoardProps) {
  const { tasksByStatus, getTaskById, moveTask, deleteTask } = tasksHook;
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      if (!over) return;

      const taskId = active.id as string;
      const draggedTask = getTaskById(taskId);
      if (!draggedTask) return;

      const overId = over.id as string;
      if (overId === WORKSPACE_TASK_TRASH_ID) {
        const result = await deleteTask(taskId);
        if (result.error) toast.error(result.error);
        else toast.success("Tarefa descartada");
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
    [deleteTask, getTaskById, tasksByStatus, moveTask]
  );

  const handleDragCancel = useCallback(() => setActiveId(null), []);

  const activeTask = activeId ? getTaskById(activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        className="flex items-start gap-4 overflow-x-auto pb-4"
        style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
      >
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
              tasks={tasksByStatus[s.id]}
              onOpenTask={onOpenTask}
            />
          </motion.div>
        ))}

        <TaskTrashDropZone />
      </div>

      <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
        {activeTask ? (
          <div style={{ transform: "rotate(2deg)" }}>
            <TaskCard task={activeTask} isDragOverlay onClick={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
