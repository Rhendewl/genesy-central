"use client";

import { DateInput } from "@/components/ui/DateInput";
import { useTags } from "@/hooks/useTags";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ClipboardCheck, Loader2, Settings, FilterX, Search, EyeOff, SlidersHorizontal, Plus } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { useWorkspaceTasks } from "@/hooks/useWorkspaceTasks";
import { useWorkspaceTaskBoards } from "@/hooks/useWorkspaceTaskBoards";
import { useWorkspaceViewing } from "@/context/WorkspaceViewingContext";
import { WorkspaceViewSwitcher, type WorkspaceView } from "@/components/workspace/WorkspaceViewSwitcher";
import { TaskBoard } from "@/components/workspace/TaskBoard";
import { TaskListView } from "@/components/workspace/TaskListView";
import { TaskDetailPanel } from "@/components/workspace/TaskDetailPanel";
import { useUsers } from "@/hooks/useUsers";
import { filterWorkspaceTasks, type WorkspaceTaskDueFilter } from "@/lib/workspace/task-filters";
import { Button } from "@/components/ui/button";
import { TaskBoardWorkspaceBar } from "@/components/workspace/TaskBoardWorkspaceBar";
import { isWorkspaceTaskHidden } from "@/lib/workspace/task-state";
import { selectWorkspaceTaskBoard } from "@/lib/workspace/task-board";

const filterClass = "h-9 shrink-0 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-xs text-[var(--text-title)] outline-none";

export default function WorkspaceKanbanPage() {
  const searchParams = useSearchParams();
  const { viewingMember } = useWorkspaceViewing();
  const boardsHook = useWorkspaceTaskBoards();
  const [activeBoardId, setActiveBoardId] = useState<string | undefined>();
  const activeBoard = useMemo(
    () => boardsHook.boards.find((board) => board.id === activeBoardId) ?? null,
    [activeBoardId, boardsHook.boards],
  );
  const tasksHook = useWorkspaceTasks(viewingMember?.auth_user_id ?? undefined, activeBoardId, undefined, false, true);
  const [showHidden, setShowHidden] = useState(false);
  const [search, setSearch] = useState("");
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (mobileSearchOpen) searchRef.current?.focus(); }, [mobileSearchOpen]);
  const [dateField, setDateField] = useState<"created_at" | "completed_at" | "due_date">("created_at");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
  const [view, setView] = useState<WorkspaceView>("kanban");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const { tags } = useTags("workspace");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [dueFilter, setDueFilter] = useState<WorkspaceTaskDueFilter>("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const { profiles } = useUsers();
  const activeProfiles = profiles.filter((profile) => profile.is_active);

  useEffect(() => {
    if (boardsHook.boards.length === 0) return;
    if (activeBoardId && boardsHook.boards.some((board) => board.id === activeBoardId)) return;
    const preferredId = searchParams.get("board")
      ?? (typeof window !== "undefined" ? window.localStorage.getItem("workspace-active-task-board") : null);
    const selected = selectWorkspaceTaskBoard(boardsHook.boards, preferredId);
    if (selected) setActiveBoardId(selected.id);
  }, [activeBoardId, boardsHook.boards, searchParams]);

  const filteredTasks = useMemo(() => {
    return filterWorkspaceTasks(tasksHook.tasks, {
      search, dateField, dateFrom, dateTo, tagIds, due: dueFilter,
      assigneeId: assigneeFilter,
    });
  }, [assigneeFilter, dueFilter, tasksHook.tasks, tagIds, search, dateField, dateFrom, dateTo]);

  const activeTasks = filteredTasks.filter(task => !isWorkspaceTaskHidden(task, new Date(clock)));
  const hiddenTasks = filteredTasks.filter(task => isWorkspaceTaskHidden(task, new Date(clock))).sort((a,b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
  const hasFilters = Boolean(search || dateFrom || dateTo || dueFilter || assigneeFilter || tagIds.length);

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

  function changeBoard(boardId: string) {
    setActiveBoardId(boardId);
    window.localStorage.setItem("workspace-active-task-board", boardId);
    setTagIds([]); setDueFilter("");
    setAssigneeFilter("");
  }

  function closePanel() {
    setIsPanelOpen(false);
    setOpenTaskId(null);
  }

  return (
    <div className="workspace-tasks-page flex flex-col pb-24">
      <div className="sr-only md:not-sr-only"><Header title="Workspace" subtitle={activeBoard ? `${activeBoard.name} · tarefas do projeto` : "Suas tarefas, sempre organizadas"} /></div>

      <div className="workspace-board-bar px-4 pb-4 sm:px-6">
        <TaskBoardWorkspaceBar
          boardsHook={boardsHook}
          activeBoard={activeBoard}
          onActiveChange={changeBoard}
          mobileExpanded={mobileToolsOpen}
          mobileActions={<>
            <button type="button" aria-label={mobileSearchOpen ? "Ocultar busca de tarefas" : "Buscar tarefas"} aria-expanded={mobileSearchOpen} aria-controls="workspace-task-search" onClick={() => setMobileSearchOpen(value => !value)} className={`workspace-mobile-icon ${search ? "is-active" : ""}`}><Search size={17} /></button>
            <button type="button" aria-label={mobileToolsOpen ? "Ocultar filtros e opções" : "Filtros e opções das tarefas"} aria-expanded={mobileToolsOpen} aria-controls="workspace-task-options workspace-task-filters" onClick={() => setMobileToolsOpen(value => !value)} className={`workspace-mobile-icon ${hasFilters || showHidden ? "is-active" : ""}`}><SlidersHorizontal size={17} />{hasFilters && <span className="workspace-mobile-dot" />}</button>
            <button type="button" aria-label="Nova tarefa" title="Nova tarefa" onClick={openCreate} className="workspace-mobile-icon workspace-mobile-create"><Plus size={19} /></button>
          </>}
        />
        {boardsHook.error && (
          <p className="mt-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
            {boardsHook.error}
          </p>
        )}
      </div>

      <div id="workspace-task-options" className={`workspace-task-options flex flex-wrap items-center justify-between gap-3 px-4 pb-4 sm:px-6 ${mobileToolsOpen ? "is-open" : ""}`}>
        <WorkspaceViewSwitcher view={view} onChange={setView} />
        <button type="button" aria-pressed={showHidden} onClick={() => setShowHidden(!showHidden)} className="workspace-task-history flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-xs"><EyeOff size={15} />{showHidden ? "Ocultar histórico" : "Mostrar ocultas"} ({hiddenTasks.length})</button>
        <div className="workspace-task-settings flex items-center gap-2">
          <Link
            href="/workspace/configuracoes/notificacoes"
            aria-label="Configurações de notificações"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--hover)]"
          >
            <Settings size={16} style={{ color: "var(--muted-foreground)" }} />
          </Link>
          <Button
            className="hidden md:inline-flex"
            onClick={openCreate}
            icon={<ClipboardCheck />}
            size="medium"
            signature
          >
            Nova Tarefa
          </Button>
        </div>
      </div>

      <div className="workspace-task-filters px-4 pb-4 sm:px-6">
        <label id="workspace-task-search" className={`workspace-task-search ${mobileSearchOpen ? "is-open" : ""} mb-3 flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3`}><Search size={17} className="text-[var(--muted-foreground)]" /><input ref={searchRef} aria-label="Pesquisar tarefas" placeholder="Pesquisar tarefas por título, descrição ou notas…" value={search} onChange={event => setSearch(event.target.value)} className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
        <div id="workspace-task-filters" className={`workspace-task-filter-content ${mobileToolsOpen ? "is-open" : ""}`}>
        <div className="workspace-task-dates mb-3 flex flex-wrap items-end gap-2">
          <label className="text-xs">Filtrar por data<select aria-label="Campo de data" className={filterClass + " ml-2"} value={dateField} onChange={event => setDateField(event.target.value as typeof dateField)}><option value="created_at">Criação</option><option value="completed_at">Conclusão</option><option value="due_date">Prazo</option></select></label>
          <label className="text-xs">De<DateInput aria-label="Data inicial" type="date" value={dateFrom} max={dateTo || undefined} onChange={event => { setDateFrom(event.target.value); if (event.target.value) setShowHidden(true); }} className={filterClass + " ml-2"} /></label>
          <label className="text-xs">Até<DateInput aria-label="Data final" type="date" value={dateTo} min={dateFrom || undefined} onChange={event => { setDateTo(event.target.value); if (event.target.value) setShowHidden(true); }} className={filterClass + " ml-2"} /></label>
          {(dateFrom || dateTo) && <span className="text-[10px] text-[var(--muted-foreground)]">Horário de Fortaleza · use Mostrar ocultas para consultar o histórico.</span>}
        </div>
        <div className="workspace-task-secondary-filters flex items-center gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none]">
          <div className="flex flex-wrap gap-1" aria-label="Filtrar etiquetas">{tags.map(tag => <button key={tag.id} aria-pressed={tagIds.includes(tag.id)} onClick={() => setTagIds(ids => ids.includes(tag.id) ? ids.filter(id => id !== tag.id) : [...ids, tag.id])} className="rounded-full border px-2 py-1 text-xs" style={{ borderColor: tag.color, background: tagIds.includes(tag.id) ? tag.color + "30" : undefined }}>{tag.name}</button>)}</div>
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
          {hasFilters && <button type="button" onClick={() => { setTagIds([]); setDueFilter(""); setAssigneeFilter(""); setSearch(""); setDateFrom(""); setDateTo(""); }} className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs text-[var(--muted-foreground)] hover:bg-[var(--hover)]"><FilterX size={13} />Limpar</button>}
          {hasFilters && <span className="ml-auto shrink-0 text-[11px] text-[var(--muted-foreground)]">{showHidden ? filteredTasks.length : activeTasks.length} de {tasksHook.tasks.length}</span>}
        </div>
      </div>

        </div>
      <div className="workspace-task-content min-w-0 flex-1 px-4 sm:px-6">
        {tasksHook.isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="animate-spin" style={{ color: "var(--muted-foreground)" }} />
          </div>
        ) : tasksHook.error ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-sm text-red-400">{tasksHook.error}</p>
          </div>
        ) : view === "kanban" ? (
          <TaskBoard tasksHook={tasksHook} visibleTasks={activeTasks} hiddenTasks={showHidden ? hiddenTasks : undefined} onOpenTask={openTask} themeColor={activeBoard?.color} />
        ) : (
          <TaskListView tasksHook={tasksHook} visibleTasks={showHidden ? filteredTasks : activeTasks} onOpenTask={openTask} />
        )}
      </div>

      <AnimatePresence>
        {isPanelOpen && (
          <TaskDetailPanel
            taskId={openTaskId}
            tasksHook={tasksHook}
            boards={boardsHook.boards}
            onClose={closePanel}
            presentation={openTaskId === null ? "modal" : "drawer"}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
