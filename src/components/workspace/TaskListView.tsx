"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { PriorityBadge } from "./PriorityBadge";
import { AssigneeAvatarGroup } from "./AssigneeAvatarGroup";
import type { WorkspaceTask } from "@/types/workspace";
import type { useWorkspaceTasks } from "@/hooks/useWorkspaceTasks";
import { TaskCompletionCelebration } from "./TaskCompletionCelebration";

interface TaskListViewProps {
  tasksHook:  ReturnType<typeof useWorkspaceTasks>;
  onOpenTask: (taskId: string) => void;
  visibleTasks?: WorkspaceTask[];
}

const PRIORITY_ORDER: Record<string, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };

export function TaskListView({ tasksHook, onOpenTask, visibleTasks }: TaskListViewProps) {
  const { tasks, toggleComplete, canExecuteTask } = tasksHook;
  const [showCompleted, setShowCompleted] = useState(false);

  const { pending, completed } = useMemo(() => {
    const source = visibleTasks ?? tasks;
    const pending  = source.filter((t) => t.status !== "concluido");
    const completed = source.filter((t) => t.status === "concluido");

    pending.sort((a, b) => {
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    });
    completed.sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));

    return { pending, completed };
  }, [tasks, visibleTasks]);

  return (
    <div className="flex flex-col gap-1">
      <TaskCompletionCelebration celebrationId={tasksHook.completionCelebrationId} />
      <AnimatePresence initial={false}>
        {pending.map((task) => (
          <TaskRow key={task.id} task={task} canExecute={canExecuteTask(task)} onToggle={toggleComplete} onOpen={onOpenTask} />
        ))}
      </AnimatePresence>

      {pending.length === 0 && (
        <p className="py-10 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
          Nenhuma tarefa pendente
        </p>
      )}

      {completed.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowCompleted((v) => !v)}
            className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium"
            style={{ color: "var(--muted-foreground)" }}
          >
            <ChevronDown size={13} className="transition-transform" style={{ transform: showCompleted ? "rotate(0deg)" : "rotate(-90deg)" }} />
            Concluídas ({completed.length})
          </button>
          <AnimatePresence initial={false}>
            {showCompleted && completed.map((task) => (
              <TaskRow key={task.id} task={task} canExecute={canExecuteTask(task)} onToggle={toggleComplete} onOpen={onOpenTask} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task, canExecute, onToggle, onOpen,
}: {
  task:     WorkspaceTask;
  canExecute: boolean;
  onToggle: (id: string) => void;
  onOpen:   (id: string) => void;
}) {
  const done = task.status === "concluido";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--hover)]"
    >
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(task.id); }}
        disabled={!canExecute}
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border transition-colors disabled:cursor-default disabled:opacity-60"
        style={{
          borderColor: done ? "var(--primary)" : "var(--border)",
          background:  done ? "var(--primary)" : "transparent",
        }}
        aria-label={!canExecute ? "Somente o criador ou responsável pode concluir esta tarefa" : done ? "Marcar como pendente" : "Marcar como concluída"}
      >
        {done && <Check size={12} color="#fff" strokeWidth={3} />}
      </button>

      <button onClick={() => onOpen(task.id)} className="flex flex-1 items-center gap-3 overflow-hidden text-left">
        <span
          className="flex-1 truncate text-sm"
          style={{
            color:         done ? "var(--muted-foreground)" : "var(--text-title)",
            textDecoration: done ? "line-through" : "none",
          }}
        >
          {task.title}
        </span>
        {!done && <PriorityBadge priority={task.priority} />}
        {task.due_date && (
          <span className="flex-shrink-0 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
            {format(new Date(`${task.due_date}T00:00:00`), "d MMM", { locale: ptBR })}
          </span>
        )}
        <AssigneeAvatarGroup assigneeIds={task.assignee_ids} size={18} />
      </button>
    </motion.div>
  );
}
