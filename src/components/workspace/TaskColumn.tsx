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
      className="flex h-[clamp(420px,calc(100dvh-220px),720px)] w-72 flex-shrink-0 flex-col rounded-[20px] transition-all duration-200"
      style={{
        background:     isOver ? "var(--hover)" : "var(--glass-bg-soft)",
        backdropFilter: "blur(14px) saturate(140%)",
        border:         isOver ? "1px solid var(--border-card-hover)" : "1px solid var(--border-card)",
        boxShadow:      isOver
          ? "0 8px 32px var(--shadow-md), inset 0 1px 0 rgba(255,255,255,0.08)"
          : "0 4px 20px var(--shadow-sm), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <span
            className="flex-1 truncate text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--text-card-secondary)" }}
          >
            {label}
          </span>
          <motion.span
            key={tasks.length}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
            className="min-w-[22px] rounded-full px-2 py-0.5 text-center text-xs font-semibold tabular-nums"
            style={{ background: "var(--hover)", color: "var(--text-card-subtle)" }}
          >
            {tasks.length}
          </motion.span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-0 [scrollbar-width:thin]">
        <div className="flex min-h-full flex-col gap-2">
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
                border:     "1.5px dashed var(--border-empty)",
                color:      isOver ? "var(--text-card-secondary)" : "var(--text-empty)",
                background: isOver ? "var(--hover)" : "transparent",
              }}
            >
              {isOver ? "↓ Soltar aqui" : "Sem tarefas"}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
