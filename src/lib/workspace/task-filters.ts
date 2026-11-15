import type { WorkspaceTask } from "@/types/workspace";

export type WorkspaceTaskDueFilter = "" | "overdue" | "today" | "next_7_days" | "no_due_date";

export interface WorkspaceTaskFilters {
  search?: string;
  dateField?: "created_at" | "completed_at" | "due_date";
  dateFrom?: string;
  dateTo?: string;
  tagIds?: string[];
  due: WorkspaceTaskDueFilter;
  assigneeId: string;
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function filterWorkspaceTasks(
  tasks: WorkspaceTask[],
  filters: WorkspaceTaskFilters,
  now = new Date(),
) {
  const today = localDateKey(now);
  const nextWeekDate = new Date(now);
  nextWeekDate.setDate(nextWeekDate.getDate() + 7);
  const nextWeek = localDateKey(nextWeekDate);
  const term = (filters.search ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
  return tasks.filter((task) => {
    if (term && ![task.title, task.description, task.notes].some(value => (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").includes(term))) return false;
    if (filters.dateFrom || filters.dateTo) {
      const raw = task[filters.dateField ?? "created_at"];
      if (!raw) return false;
      const date = filters.dateField === "due_date" ? raw.slice(0, 10) : new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(raw));
      if (filters.dateFrom && date < filters.dateFrom) return false;
      if (filters.dateTo && date > filters.dateTo) return false;
    }
    if (filters.tagIds?.length && !filters.tagIds.every(id => task.tags?.includes(id))) return false;
    const assigneeIds = Array.isArray(task.assignee_ids) ? task.assignee_ids : [];
    const dueDate = typeof task.due_date === "string" ? task.due_date.slice(0, 10) : "";

    if (filters.assigneeId === "unassigned" && assigneeIds.length > 0) return false;
    if (filters.assigneeId && filters.assigneeId !== "unassigned" && !assigneeIds.includes(filters.assigneeId)) return false;
    if (filters.due === "no_due_date" && dueDate) return false;
    if (filters.due === "overdue" && (!dueDate || dueDate >= today || task.status === "concluido")) return false;
    if (filters.due === "today" && dueDate !== today) return false;
    if (filters.due === "next_7_days" && (!dueDate || dueDate < today || dueDate > nextWeek)) return false;
    return true;
  });
}
