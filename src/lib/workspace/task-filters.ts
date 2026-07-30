import type { WorkspaceTask } from "@/types/workspace";

export type WorkspaceTaskDueFilter = "" | "overdue" | "today" | "next_7_days" | "no_due_date";

export interface WorkspaceTaskFilters {
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
  return tasks.filter((task) => {
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
