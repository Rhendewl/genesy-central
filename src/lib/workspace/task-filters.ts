import type { Tag } from "@/types";
import type { WorkspaceTask } from "@/types/workspace";

export type WorkspaceTaskDueFilter = "" | "overdue" | "today" | "next_7_days" | "no_due_date";

export interface WorkspaceTaskFilters {
  tagId: string;
  due: WorkspaceTaskDueFilter;
  assigneeId: string;
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function comparable(value: string) {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

/**
 * Filtra também tarefas legadas, que podem ter salvo o nome da etiqueta em
 * vez do UUID, e tolera arrays ausentes vindos de registros mais antigos.
 */
export function filterWorkspaceTasks(
  tasks: WorkspaceTask[],
  filters: WorkspaceTaskFilters,
  tags: Tag[],
  now = new Date(),
) {
  const today = localDateKey(now);
  const nextWeekDate = new Date(now);
  nextWeekDate.setDate(nextWeekDate.getDate() + 7);
  const nextWeek = localDateKey(nextWeekDate);
  const selectedTag = filters.tagId ? tags.find((tag) => tag.id === filters.tagId) : undefined;
  const tagAliases = new Set(
    [filters.tagId, selectedTag?.name ?? ""].filter(Boolean).map(comparable),
  );

  return tasks.filter((task) => {
    const taskTags = Array.isArray(task.tags) ? task.tags.map(comparable) : [];
    const assigneeIds = Array.isArray(task.assignee_ids) ? task.assignee_ids : [];
    const dueDate = typeof task.due_date === "string" ? task.due_date.slice(0, 10) : "";

    if (tagAliases.size > 0 && !taskTags.some((tag) => tagAliases.has(tag))) return false;
    if (filters.assigneeId === "unassigned" && assigneeIds.length > 0) return false;
    if (filters.assigneeId && filters.assigneeId !== "unassigned" && !assigneeIds.includes(filters.assigneeId)) return false;
    if (filters.due === "no_due_date" && dueDate) return false;
    if (filters.due === "overdue" && (!dueDate || dueDate >= today || task.status === "concluido")) return false;
    if (filters.due === "today" && dueDate !== today) return false;
    if (filters.due === "next_7_days" && (!dueDate || dueDate < today || dueDate > nextWeek)) return false;
    return true;
  });
}
