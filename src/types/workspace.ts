// ── Workspace — Tarefas / Kanban / To-do List ─────────────────────────────────

export type WorkspaceTaskStatus = "a_fazer" | "em_andamento" | "aguardando" | "concluido";
export type WorkspaceTaskPriority = "baixa" | "media" | "alta" | "urgente";

export const WORKSPACE_TASK_STATUSES: { id: WorkspaceTaskStatus; label: string }[] = [
  { id: "a_fazer",      label: "A Fazer" },
  { id: "em_andamento", label: "Em andamento" },
  { id: "aguardando",   label: "Aguardando" },
  { id: "concluido",    label: "Concluído" },
];

export const WORKSPACE_TASK_PRIORITIES: { id: WorkspaceTaskPriority; label: string; color: string }[] = [
  { id: "baixa",   label: "Baixa",   color: "#6b9b6f" },
  { id: "media",   label: "Média",   color: "#4a8fd4" },
  { id: "alta",    label: "Alta",    color: "#e0a344" },
  { id: "urgente", label: "Urgente", color: "#e05c5c" },
];

export interface WorkspaceTask {
  id:           string;
  user_id:      string;
  created_by:   string;
  title:        string;
  description:  string | null;
  status:       WorkspaceTaskStatus;
  priority:     WorkspaceTaskPriority;
  assignee_ids: string[];
  tags:         string[];
  due_date:     string | null;
  due_time:     string | null;
  color:        string | null;
  notes:        string | null;
  position:     number;
  completed_at: string | null;
  created_at:   string;
  updated_at:   string;
  // Denormalized counts, populated client-side by useWorkspaceTasks() for card badges
  checklist_total?: number;
  checklist_done?:  number;
  comment_count?:   number;
}

export type NewWorkspaceTask = Pick<WorkspaceTask, "title"> & Partial<Pick<WorkspaceTask,
  "description" | "priority" | "assignee_ids" | "tags" | "due_date" | "due_time" | "color" | "notes" | "status"
>>;

export type UpdateWorkspaceTask = Partial<Pick<WorkspaceTask,
  "title" | "description" | "priority" | "assignee_ids" | "tags" | "due_date" | "due_time" | "color" | "notes"
>>;

export interface WorkspaceTaskChecklistItem {
  id:             string;
  task_id:        string;
  label:          string;
  is_completed:   boolean;
  position:       number;
  linked_task_id: string | null;
  created_at:     string;
  updated_at:     string;
}

export interface WorkspaceTaskComment {
  id:         string;
  task_id:    string;
  author_id:  string | null;
  body:       string;
  created_at: string;
}

export interface WorkspaceTaskAttachment {
  id:           string;
  task_id:      string;
  file_name:    string;
  mime_type:    string;
  file_size:    number | null;
  storage_path: string;
  public_url:   string;
  created_at:   string;
}

// Retorno de GET /api/workspace/tasks/[id]
export interface WorkspaceTaskDetail extends WorkspaceTask {
  checklist_items: WorkspaceTaskChecklistItem[];
  comments:        WorkspaceTaskComment[];
  attachments:     WorkspaceTaskAttachment[];
}
