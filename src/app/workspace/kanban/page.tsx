"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Loader2, Settings } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { useWorkspaceTasks } from "@/hooks/useWorkspaceTasks";
import { useWorkspaceViewing } from "@/context/WorkspaceViewingContext";
import { WorkspaceViewSwitcher, type WorkspaceView } from "@/components/workspace/WorkspaceViewSwitcher";
import { TaskBoard } from "@/components/workspace/TaskBoard";
import { TaskListView } from "@/components/workspace/TaskListView";
import { TaskDetailPanel } from "@/components/workspace/TaskDetailPanel";

export default function WorkspaceKanbanPage() {
  const { viewingMember } = useWorkspaceViewing();
  const tasksHook = useWorkspaceTasks(viewingMember?.auth_user_id ?? undefined);
  const [view, setView] = useState<WorkspaceView>("kanban");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  function openTask(taskId: string) {
    setOpenTaskId(taskId);
    setIsPanelOpen(true);
  }

  function openCreate() {
    setOpenTaskId(null);
    setIsPanelOpen(true);
  }

  function closePanel() {
    setIsPanelOpen(false);
    setOpenTaskId(null);
  }

  return (
    <div className="flex flex-col pb-24">
      <Header title="Workspace" subtitle="Suas tarefas, sempre organizadas" />

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-4 sm:px-6">
        <WorkspaceViewSwitcher view={view} onChange={setView} />
        <div className="flex items-center gap-2">
          <Link
            href="/workspace/configuracoes/notificacoes"
            aria-label="Configurações de notificações"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--hover)]"
          >
            <Settings size={16} style={{ color: "var(--muted-foreground)" }} />
          </Link>
          <motion.button
            onClick={openCreate}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="lc-btn flex items-center gap-2 px-4 py-2 text-sm"
          >
            <Plus size={16} strokeWidth={2.5} />
            Nova Tarefa
          </motion.button>
        </div>
      </div>

      <div className="min-w-0 flex-1 px-4 sm:px-6">
        {tasksHook.isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="animate-spin" style={{ color: "var(--muted-foreground)" }} />
          </div>
        ) : tasksHook.error ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-sm text-red-400">{tasksHook.error}</p>
          </div>
        ) : view === "kanban" ? (
          <TaskBoard tasksHook={tasksHook} onOpenTask={openTask} />
        ) : (
          <TaskListView tasksHook={tasksHook} onOpenTask={openTask} />
        )}
      </div>

      <AnimatePresence>
        {isPanelOpen && (
          <TaskDetailPanel taskId={openTaskId} tasksHook={tasksHook} onClose={closePanel} />
        )}
      </AnimatePresence>
    </div>
  );
}
