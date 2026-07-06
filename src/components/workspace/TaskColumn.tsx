"use client";

import { useDroppable } from "@dnd-kit/core";
import { AnimatePresence, motion } from "framer-motion";
import { TaskCard } from "./TaskCard";
import type { WorkspaceTask, WorkspaceTaskStatus } from "@/types/workspace";

interface TaskColumnProps {
  status:     WorkspaceTaskStatus;
  label:      string;
  tasks:      WorkspaceTask[];
  onOpenTask: (taskId: string) => void;
}

export function TaskColumn({ status, label, tasks, onOpenTask }: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className="flex w-72 flex-shrink-0 flex-col rounded-[20px] transition-all duration-200"
      style={{
        background:     isOver ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.32)",
        backdropFilter: "blur(14px) saturate(140%)",
        border:         isOver ? "1px solid rgba(255,255,255,0.14)" : "1px solid rgba(255,255,255,0.07)",
        boxShadow:      isOver
          ? "0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)"
          : "0 4px 20px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.04)",
        minHeight: 500,
      }}
    >
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <span
            className="flex-1 truncate text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            {label}
          </span>
          <motion.span
            key={tasks.length}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
            className="min-w-[22px] rounded-full px-2 py-0.5 text-center text-xs font-semibold tabular-nums"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)" }}
          >
            {tasks.length}
          </motion.span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <AnimatePresence initial={false}>
          {tasks.map((task) => (
            <motion.div
              key={task.id}
              layout
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <TaskCard task={task} onClick={() => onOpenTask(task.id)} />
            </motion.div>
          ))}
        </AnimatePresence>

        {tasks.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-1 items-center justify-center rounded-2xl py-10 text-xs transition-all duration-200"
            style={{
              border:     "1.5px dashed rgba(255,255,255,0.10)",
              color:      isOver ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.25)",
              background: isOver ? "rgba(255,255,255,0.04)" : "transparent",
            }}
          >
            {isOver ? "↓ Soltar aqui" : "Sem tarefas"}
          </motion.div>
        )}
      </div>
    </div>
  );
}
