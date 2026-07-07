"use client";

import { useDraggable } from "@dnd-kit/core";
import { MessageSquare, Calendar as CalendarIcon } from "lucide-react";
import { format, isBefore, isToday, isTomorrow, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { cn } from "@/lib/utils";
import { PriorityBadge } from "./PriorityBadge";
import { TagChip } from "./TagChip";
import { AssigneeAvatarGroup } from "./AssigneeAvatarGroup";
import type { WorkspaceTask } from "@/types/workspace";

interface TaskCardProps {
  task: WorkspaceTask;
  isDragOverlay?: boolean;
  onClick: () => void;
}

function dueDateLabel(dateStr: string): { label: string; overdue: boolean } {
  const date = startOfDay(new Date(`${dateStr}T00:00:00`));
  const today = startOfDay(new Date());
  if (isToday(date))    return { label: "Hoje",   overdue: false };
  if (isTomorrow(date)) return { label: "Amanhã", overdue: false };
  const overdue = isBefore(date, today);
  return { label: format(date, "d MMM", { locale: ptBR }), overdue };
}

export function TaskCard({ task, isDragOverlay = false, onClick }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    disabled: isDragOverlay,
  });

  const due = task.due_date ? dueDateLabel(task.due_date) : null;
  const hasChecklist = (task.checklist_total ?? 0) > 0;
  const checklistPct = hasChecklist ? Math.round(((task.checklist_done ?? 0) / (task.checklist_total ?? 1)) * 100) : 0;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "group relative select-none rounded-[18px] border p-3.5 transition-all duration-200",
        isDragging && !isDragOverlay ? "cursor-grabbing opacity-30" : "cursor-pointer hover:-translate-y-0.5",
        isDragOverlay && "cursor-grabbing"
      )}
      style={{
        background:     "var(--bg-lead-card)",
        borderColor:    "var(--border-card)",
        boxShadow:      isDragOverlay ? "0 28px 64px var(--shadow-lg), 0 0 0 1px var(--border-card-drag)" : undefined,
        touchAction:    "none",
        borderLeft:     task.color ? `3px solid ${task.color}` : undefined,
      }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="flex-1 text-[13px] font-medium leading-snug" style={{ color: "var(--text-title)" }}>
          {task.title}
        </p>
        <AssigneeAvatarGroup assigneeIds={task.assignee_ids} size={18} />
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1">
        <PriorityBadge priority={task.priority} />
        {task.tags.slice(0, 3).map((tagId) => <TagChip key={tagId} tagId={tagId} />)}
      </div>

      {hasChecklist && (
        <div className="mb-2">
          <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: "var(--border-card)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${checklistPct}%`, background: "var(--primary)" }}
            />
          </div>
          <p className="mt-1 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
            {task.checklist_done}/{task.checklist_total} concluídos
          </p>
        </div>
      )}

      <div className="flex items-center gap-3 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
        {due && (
          <span className="flex items-center gap-1" style={due.overdue ? { color: "#e0a344" } : undefined}>
            <CalendarIcon size={11} />
            {due.label}
          </span>
        )}
        {(task.comment_count ?? 0) > 0 && (
          <span className="flex items-center gap-1">
            <MessageSquare size={11} />
            {task.comment_count}
          </span>
        )}
      </div>
    </div>
  );
}
