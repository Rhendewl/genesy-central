"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { BellRing, Plus, Loader2, Settings } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { useWorkspaceTasks } from "@/hooks/useWorkspaceTasks";
import { useWorkspaceViewing } from "@/context/WorkspaceViewingContext";
import { ensurePushSubscription } from "@/lib/notifications/push-client";
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
  const [isTestingPush, setIsTestingPush] = useState(false);

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

  async function handleTestNotification() {
    setIsTestingPush(true);
    try {
      const subscription = await ensurePushSubscription({ requestPermission: true });
      if (!subscription) {
        toast.error("Permissão de notificação não concedida neste dispositivo.");
        return;
      }

      const res = await fetch("/api/workspace/notifications/test", { method: "POST" });
      const json = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Erro ao enviar teste");
      toast.success("Notificação de teste enviada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao testar notificação");
    } finally {
      setIsTestingPush(false);
    }
  }

  return (
    <div className="flex flex-col pb-24">
      <Header title="Workspace" subtitle="Suas tarefas, sempre organizadas" />

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-4 sm:px-6">
        <WorkspaceViewSwitcher view={view} onChange={setView} />
        <div className="flex items-center gap-2">
          <button
            onClick={handleTestNotification}
            disabled={isTestingPush}
            className="flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors disabled:opacity-50"
            style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}
          >
            {isTestingPush ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={14} />}
            Testar notificação
          </button>
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

      <div className="flex-1 px-4 sm:px-6">
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
