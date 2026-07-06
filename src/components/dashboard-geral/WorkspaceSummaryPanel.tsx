"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { ArrowUpRight, LayoutGrid } from "lucide-react";
import { HalfDonutGauge } from "./HalfDonutGauge";
import { PriorityBadge } from "@/components/workspace/PriorityBadge";
import { TaskDetailPanel } from "@/components/workspace/TaskDetailPanel";
import type { useWorkspaceTasks } from "@/hooks/useWorkspaceTasks";
import type { WorkspaceTaskPriority } from "@/types/workspace";

const PRIORITY_ORDER: Record<WorkspaceTaskPriority, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };

interface WorkspaceSummaryPanelProps {
  tasksHook: ReturnType<typeof useWorkspaceTasks>;
  height:    number;
  delay?:    number;
}

export function WorkspaceSummaryPanel({ tasksHook, height, delay = 0 }: WorkspaceSummaryPanelProps) {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const totalTasks = tasksHook.tasks.length;
  const doneTasks  = tasksHook.tasks.filter((t) => t.status === "concluido").length;
  const tasksPercent = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;

  const pendingTasks = tasksHook.tasks
    .filter((t) => t.status === "a_fazer" || t.status === "aguardando")
    .sort((a, b) => {
      const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (p !== 0) return p;
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    });

  return (
    <motion.div
      className="lc-card flex p-6"
      style={{ background: "rgba(0,0,0,0.31)", height }}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
    >
      <div
        className="flex w-[150px] flex-shrink-0 flex-col items-center justify-center gap-3 pr-6"
        style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2 self-start">
          <LayoutGrid size={15} style={{ color: "#ffffff" }} />
          <p className="text-[12px] font-semibold leading-tight" style={{ color: "#b4b4b4" }}>Workspace</p>
        </div>
        <HalfDonutGauge percent={tasksPercent} label="Progresso" caption={`${doneTasks}/${totalTasks} tarefas`} size={132} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col pl-6">
        <div className="mb-3 flex flex-shrink-0 items-center justify-between">
          <p className="text-[13px] font-semibold leading-tight" style={{ color: "#b4b4b4" }}>Tarefas pendentes</p>
          <Link href="/workspace" className="text-[var(--muted-foreground)] hover:text-white/80">
            <ArrowUpRight size={15} />
          </Link>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {pendingTasks.length === 0 ? (
            <p className="py-6 text-center text-xs" style={{ color: "var(--muted-foreground)" }}>
              Nenhuma tarefa em A Fazer ou Aguardando
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {pendingTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 transition-colors hover:bg-white/[0.03]">
                  <button
                    onClick={() => tasksHook.toggleComplete(task.id)}
                    className="flex flex-shrink-0 items-center justify-center rounded-full border transition-colors"
                    style={{ width: "16px", height: "16px", borderColor: "rgba(255,255,255,0.25)", background: "transparent" }}
                    aria-label="Marcar como concluída"
                  />
                  <button
                    onClick={() => { setOpenTaskId(task.id); setIsPanelOpen(true); }}
                    className="flex flex-1 items-center gap-2 overflow-hidden text-left"
                  >
                    <span className="flex-1 truncate text-[13px]" style={{ color: "var(--text-title)" }}>{task.title}</span>
                    <PriorityBadge priority={task.priority} />
                    {task.due_date && (
                      <span className="flex-shrink-0 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                        {format(new Date(`${task.due_date}T00:00:00`), "d MMM", { locale: ptBR })}
                      </span>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isPanelOpen && (
          <TaskDetailPanel taskId={openTaskId} tasksHook={tasksHook} onClose={() => { setIsPanelOpen(false); setOpenTaskId(null); }} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
