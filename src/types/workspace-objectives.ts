import type { WorkspaceTaskPriority } from "./workspace";

export interface WorkspaceObjective {
  id:          string;
  user_id:     string;
  created_by:  string;
  title:       string;
  description: string | null;
  priority:    WorkspaceTaskPriority;
  assignee_id: string | null;
  tags:        string[];
  due_date:    string | null;
  created_at:  string;
  updated_at:  string;
  // Denormalizado client-side por useWorkspaceObjectives(), para o card/progresso
  steps_total?: number;
  steps_done?:  number;
  steps?:       WorkspaceObjectiveStep[];
}

export type NewWorkspaceObjective = Pick<WorkspaceObjective, "title"> & Partial<Pick<WorkspaceObjective,
  "description" | "priority" | "assignee_id" | "tags" | "due_date"
>>;

export type UpdateWorkspaceObjective = Partial<Pick<WorkspaceObjective,
  "title" | "description" | "priority" | "assignee_id" | "tags" | "due_date"
>>;

export interface WorkspaceObjectiveStep {
  id:           string;
  objective_id: string;
  label:        string;
  is_completed: boolean;
  position:     number;
  created_at:   string;
  updated_at:   string;
}

export interface WorkspaceObjectiveComment {
  id:           string;
  objective_id: string;
  author_id:    string | null;
  body:         string;
  created_at:   string;
}

export interface WorkspaceObjectiveAttachment {
  id:           string;
  objective_id: string;
  file_name:    string;
  mime_type:    string;
  file_size:    number | null;
  storage_path: string;
  public_url:   string;
  created_at:   string;
}

export interface WorkspaceObjectiveDetail extends WorkspaceObjective {
  steps:       WorkspaceObjectiveStep[];
  comments:    WorkspaceObjectiveComment[];
  attachments: WorkspaceObjectiveAttachment[];
}
