"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ClipboardCheck, Loader2, Settings, FilterX } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { useWorkspaceTasks } from "@/hooks/useWorkspaceTasks";
import { useWorkspaceViewing } from "@/context/WorkspaceViewingContext";
import { WorkspaceViewSwitcher, type WorkspaceView } from "@/components/workspace/WorkspaceViewSwitcher";
import { TaskBoard } from "@/components/workspace/TaskBoard";
import { TaskListView } from "@/components/workspace/TaskListView";
import { TaskDetailPanel } from "@/components/workspace/TaskDetailPanel";
import { useTags } from "@/hooks/useTags";
import { useUsers } from "@/hooks/useUsers";
import { filterWorkspaceTasks, type WorkspaceTaskDueFilter } from "@/lib/workspace/task-filters";
import { Button } from "@/components/ui/button";

const filterClass = "h-9 shrink-0 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-xs text-[var(--text-title)] outline-none";

export default function WorkspaceKanbanPage() {
  const searchParams = useSearchParams();
  const { viewingMember } = useWorkspaceViewing();
  const tasksHook = useWorkspaceTasks(viewingMember?.auth_user_id ?? undefined);
  const [view, setView] = useState<WorkspaceView>("kanban");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [tagFilter, setTagFilter] = useState("");
  const [dueFilter, setDueFilter] = useState<WorkspaceTaskDueFilter>("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const { tags } = useTags();
  const { profiles } = useUsers();
  const activeProfiles = profiles.filter((profile) => profile.is_active);

  const filteredTasks = useMemo(() => {
    return filterWorkspaceTasks(tasksHook.tasks, {
      tagId: tagFilter,
      due: dueFilter,
      assigneeId: assigneeFilter,
    }, tags);
  }, [assigneeFilter, dueFilter, tagFilter, tags, tasksHook.tasks]);

  const hasFilters = Boolean(tagFilter || dueFilter || assigneeFilter);

  useEffect(() => {
    const taskId = searchParams.get("task");
    if (!taskId) return;
    setOpenTaskId(taskId);
    setIsPanelOpen(true);
  }, [searchParams]);

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
          <Button
            onClick={openCreate}
            icon={<ClipboardCheck />}
            size="medium"
            signature
          >
            Nova Tarefa
          </Button>
        </div>
      </div>

      <div className="px-4 pb-4 sm:px-6">
        <div className="flex items-center gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none]">
          <select aria-label="Filtrar por etiqueta" value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} className={filterClass}>
            <option value="">Todas as etiquetas</option>
            {tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
          </select>
          <select aria-label="Filtrar por prazo" value={dueFilter} onChange={(event) => setDueFilter(event.target.value as WorkspaceTaskDueFilter)} className={filterClass}>
            <option value="">Todos os prazos</option>
            <option value="overdue">Atrasadas</option>
            <option value="today">Vencem hoje</option>
            <option value="next_7_days">Próximos 7 dias</option>
            <option value="no_due_date">Sem prazo</option>
          </select>
          <select aria-label="Filtrar por responsável" value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)} className={filterClass}>
            <option value="">Todos os responsáveis</option>
            <option value="unassigned">Sem responsável</option>
            {activeProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}
          </select>
          {hasFilters && <button type="button" onClick={() => { setTagFilter(""); setDueFilter(""); setAssigneeFilter(""); }} className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs text-[var(--muted-foreground)] hover:bg-[var(--hover)]"><FilterX size={13} />Limpar</button>}
          {hasFilters && <span className="ml-auto shrink-0 text-[11px] text-[var(--muted-foreground)]">{filteredTasks.length} de {tasksHook.tasks.length}</span>}
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
          <TaskBoard tasksHook={tasksHook} visibleTasks={filteredTasks} onOpenTask={openTask} />
        ) : (
          <TaskListView tasksHook={tasksHook} visibleTasks={filteredTasks} onOpenTask={openTask} />
        )}
      </div>

      <AnimatePresence>
        {isPanelOpen && (
          <TaskDetailPanel
            taskId={openTaskId}
            tasksHook={tasksHook}
            onClose={closePanel}
            presentation={openTaskId === null ? "modal" : "drawer"}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
