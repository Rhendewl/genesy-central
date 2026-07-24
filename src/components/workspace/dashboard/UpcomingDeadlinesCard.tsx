"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { ArrowUpRight, CalendarClock } from "lucide-react";
import { PriorityBadge } from "@/components/workspace/PriorityBadge";
import { AssigneeAvatarGroup } from "@/components/workspace/AssigneeAvatarGroup";
import { TaskDetailPanel } from "@/components/workspace/TaskDetailPanel";
import type { useWorkspaceTasks } from "@/hooks/useWorkspaceTasks";

const MAX_VISIBLE = 5;

interface UpcomingDeadlinesCardProps {
  tasksHook:   ReturnType<typeof useWorkspaceTasks>;
  delay?:      number;
  /** Quando true, não desenha o próprio card de vidro — usado ao aninhar
   * dentro de outro card (ex: painel resumo do Workspace no Dashboard Geral). */
  bare?:       boolean;
  maxVisible?: number;
}

export function UpcomingDeadlinesCard({ tasksHook, delay = 0, bare = false, maxVisible = MAX_VISIBLE }: UpcomingDeadlinesCardProps) {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const today = useMemo(() => startOfDay(new Date()), []);
  const todayKey = format(today, "yyyy-MM-dd");

  const upcoming = tasksHook.tasks
    .filter((t) => t.status !== "concluido" && !!t.due_date)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : a.due_date! > b.due_date! ? 1 : 0))
    .slice(0, maxVisible);

  return (
    <motion.div
      className={bare ? "" : "lc-card p-6"}
      style={bare ? undefined : { background: "var(--glass-bg-soft)" }}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl">
            <CalendarClock size={17} style={{ color: "var(--text-title)" }} />
          </div>
          <div>
            <p className="text-[13px] font-semibold leading-tight" style={{ color: "var(--silver)" }}>Próximas Entregas</p>
            <p className="text-[10px] text-[var(--muted-foreground)]">Mais urgente primeiro</p>
          </div>
        </div>
        <Link href="/workspace/kanban" className="text-[var(--muted-foreground)] hover:text-[var(--text-title)]">
          <ArrowUpRight size={15} />
        </Link>
      </div>

      <div className="flex flex-col gap-1">
        {upcoming.length === 0 && (
          <p className="py-6 text-center text-xs" style={{ color: "var(--muted-foreground)" }}>
            Nenhum prazo agendado
          </p>
        )}
        {upcoming.map((task) => {
          const overdue = task.due_date! < todayKey;
          return (
            <button
              key={task.id}
              onClick={() => { setOpenTaskId(task.id); setIsPanelOpen(true); }}
              className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-[var(--hover)]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm" style={{ color: "var(--text-title)" }}>{task.title}</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="text-[10px]" style={overdue ? { color: "#e0a344" } : { color: "var(--muted-foreground)" }}>
                    {format(new Date(`${task.due_date}T00:00:00`), "d MMM", { locale: ptBR })}
                  </span>
                  <PriorityBadge priority={task.priority} />
                </div>
              </div>
              <AssigneeAvatarGroup assigneeIds={task.assignee_ids} size={18} />
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {isPanelOpen && (
          <TaskDetailPanel presentation="modal" taskId={openTaskId} tasksHook={tasksHook} onClose={() => { setIsPanelOpen(false); setOpenTaskId(null); }} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
