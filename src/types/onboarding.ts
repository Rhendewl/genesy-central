import type { WorkspaceTaskPriority } from "@/types/workspace";

export type { WorkspaceTaskPriority as OnboardingPriority };

// ── Templates ──────────────────────────────────────────────────────────────────

export interface OnboardingTemplate {
  id:          string;
  user_id:     string;
  created_by:  string;
  name:        string;
  description: string | null;
  is_active:   boolean;
  created_at:  string;
  updated_at:  string;
  // Populado só na listagem, calculado a partir das etapas/tarefas.
  stage_count?: number;
  task_count?:  number;
}

export type NewOnboardingTemplate = Pick<OnboardingTemplate, "name"> & Partial<Pick<OnboardingTemplate, "description" | "is_active">>;
export type UpdateOnboardingTemplate = Partial<Pick<OnboardingTemplate, "name" | "description" | "is_active">>;

export interface OnboardingTemplateStage {
  id:                string;
  template_id:       string;
  name:              string;
  order_index:       number;
  relative_due_days: number;
  color:             string;
  created_at:        string;
  updated_at:        string;
}

export type NewOnboardingTemplateStage = Pick<OnboardingTemplateStage, "name"> &
  Partial<Pick<OnboardingTemplateStage, "order_index" | "relative_due_days" | "color">>;
export type UpdateOnboardingTemplateStage = Partial<Pick<OnboardingTemplateStage, "name" | "order_index" | "relative_due_days" | "color">>;

export interface OnboardingTemplateTask {
  id:                       string;
  stage_id:                 string;
  title:                    string;
  description:              string | null;
  role_key:                 string | null;
  weight:                   number;
  priority:                 WorkspaceTaskPriority;
  relative_due_days:        number | null;
  required_document_labels: string[];
  order_index:              number;
  created_at:               string;
  updated_at:               string;
  depends_on_task_ids?:     string[];
}

export type NewOnboardingTemplateTask = Pick<OnboardingTemplateTask, "title"> & Partial<Pick<OnboardingTemplateTask,
  "description" | "role_key" | "weight" | "priority" | "relative_due_days" | "required_document_labels" | "order_index" | "depends_on_task_ids"
>>;
export type UpdateOnboardingTemplateTask = Partial<Pick<OnboardingTemplateTask,
  "title" | "description" | "role_key" | "weight" | "priority" | "relative_due_days" | "required_document_labels" | "order_index" | "depends_on_task_ids"
>>;

export interface OnboardingTemplateDocument {
  id:          string;
  template_id: string;
  label:       string;
  order_index: number;
  created_at:  string;
}

export type NewOnboardingTemplateDocument = Pick<OnboardingTemplateDocument, "label"> & Partial<Pick<OnboardingTemplateDocument, "order_index">>;
export type UpdateOnboardingTemplateDocument = Partial<Pick<OnboardingTemplateDocument, "label" | "order_index">>;

// Detalhe completo do template (construtor): etapas com suas tarefas aninhadas.
export interface OnboardingTemplateDetail extends OnboardingTemplate {
  stages:    (OnboardingTemplateStage & { tasks: OnboardingTemplateTask[] })[];
  documents: OnboardingTemplateDocument[];
}

// ── Projetos (instâncias) ─────────────────────────────────────────────────────

// "Saúde"/status de exibição — sempre computado no read (manual_status tem
// prioridade; senão deriva de progresso/prazos), nunca armazenado.
export type OnboardingProjectStatus = "em_andamento" | "aguardando_cliente" | "em_risco" | "atrasado" | "concluido" | "cancelado";

export const ONBOARDING_PROJECT_STATUSES: { id: OnboardingProjectStatus; label: string; color: string }[] = [
  { id: "em_andamento",      label: "Em andamento",      color: "#6b9b6f" },
  { id: "aguardando_cliente", label: "Aguardando cliente", color: "#4a8fd4" },
  { id: "em_risco",          label: "Em risco",          color: "#e0a344" },
  { id: "atrasado",          label: "Atrasado",          color: "#e05c5c" },
  { id: "concluido",         label: "Concluído",         color: "#27a3ff" },
  { id: "cancelado",         label: "Cancelado",         color: "#7c878e" },
];

export interface OnboardingProject {
  id:            string;
  user_id:       string;
  created_by:    string;
  client_id:     string | null;
  template_id:   string | null;
  name:          string;
  start_date:    string;
  target_date:   string | null;
  manual_status: "aguardando_cliente" | "cancelado" | null;
  created_at:    string;
  updated_at:    string;
}

export type NewOnboardingProject = Pick<OnboardingProject, "name" | "client_id"> & Partial<Pick<OnboardingProject,
  "template_id" | "start_date" | "target_date"
>> & {
  // Chave = role_key do template, valor = user_profiles.id escolhido para o cargo.
  role_assignments?: Record<string, string>;
};

export type UpdateOnboardingProject = Partial<Pick<OnboardingProject, "name" | "target_date" | "manual_status">>;

// Linha da lista/dashboard — projeto + progresso agregado, computado no servidor.
export interface OnboardingProjectSummary extends OnboardingProject {
  client_name:      string | null;
  status:           OnboardingProjectStatus;
  progress_percent: number;
  current_stage_name: string | null;
  tasks_pending:    number;
  tasks_overdue:    number;
}

export interface OnboardingProjectStage {
  id:          string;
  project_id:  string;
  name:        string;
  order_index: number;
  due_date:    string | null;
  color:       string;
  created_at:  string;
  updated_at:  string;
  // Populado só no detalhe do projeto.
  progress_percent?: number;
}

export type NewOnboardingProjectStage = Pick<OnboardingProjectStage, "name"> &
  Partial<Pick<OnboardingProjectStage, "order_index" | "due_date" | "color">>;
export type UpdateOnboardingProjectStage = Partial<Pick<OnboardingProjectStage, "name" | "order_index" | "due_date" | "color">>;

export type OnboardingTaskStatus =
  | "a_fazer" | "em_andamento" | "aguardando" | "bloqueado" | "aguardando_cliente" | "concluido" | "cancelado";

export const ONBOARDING_TASK_STATUSES: { id: OnboardingTaskStatus; label: string }[] = [
  { id: "a_fazer",           label: "A Fazer" },
  { id: "em_andamento",      label: "Em andamento" },
  { id: "aguardando",        label: "Aguardando" },
  { id: "bloqueado",         label: "Bloqueado" },
  { id: "aguardando_cliente", label: "Aguardando Cliente" },
  { id: "concluido",         label: "Concluído" },
  { id: "cancelado",         label: "Cancelado" },
];

export interface OnboardingTask {
  id:                       string;
  user_id:                  string;
  created_by:               string;
  project_id:               string;
  stage_id:                 string;
  title:                    string;
  description:              string | null;
  role_key:                 string | null;
  assignee_profile_id:      string | null;
  weight:                   number;
  priority:                 WorkspaceTaskPriority;
  status:                   OnboardingTaskStatus;
  due_date:                 string | null;
  position:                 number;
  required_document_labels: string[];
  completed_at:             string | null;
  created_at:               string;
  updated_at:               string;
  // Denormalizados, populados client-side pela listagem/detalhe.
  assignee_name?:       string | null;
  depends_on_task_ids?: string[];
  checklist_total?:     number;
  checklist_done?:      number;
  comment_count?:       number;
}

export type NewOnboardingTask = Pick<OnboardingTask, "title" | "stage_id"> & Partial<Pick<OnboardingTask,
  "description" | "role_key" | "assignee_profile_id" | "weight" | "priority" | "due_date" | "required_document_labels" | "depends_on_task_ids"
>>;

export type UpdateOnboardingTask = Partial<Pick<OnboardingTask,
  "title" | "description" | "role_key" | "assignee_profile_id" | "weight" | "priority" | "due_date" | "required_document_labels"
>>;

export interface OnboardingTaskDependency {
  id:                 string;
  task_id:            string;
  depends_on_task_id: string;
  created_at:         string;
}

export interface OnboardingTaskChecklistItem {
  id:           string;
  task_id:      string;
  label:        string;
  is_completed: boolean;
  position:     number;
  created_at:   string;
  updated_at:   string;
}

export interface OnboardingTaskComment {
  id:         string;
  task_id:    string;
  author_id:  string | null;
  body:       string;
  created_at: string;
}

export interface OnboardingTaskAttachment {
  id:           string;
  task_id:      string;
  file_name:    string;
  mime_type:    string;
  file_size:    number | null;
  storage_path: string;
  public_url:   string;
  created_at:   string;
}

// Retorno de GET /api/workspace/onboarding/projects/[id]/tasks/[id]
export interface OnboardingTaskDetail extends OnboardingTask {
  checklist_items: OnboardingTaskChecklistItem[];
  comments:        OnboardingTaskComment[];
  attachments:     OnboardingTaskAttachment[];
}

export type OnboardingDocumentStatus = "nao_solicitado" | "solicitado" | "recebido" | "validado";

export const ONBOARDING_DOCUMENT_STATUSES: { id: OnboardingDocumentStatus; label: string }[] = [
  { id: "nao_solicitado", label: "Não solicitado" },
  { id: "solicitado",     label: "Solicitado" },
  { id: "recebido",       label: "Recebido" },
  { id: "validado",       label: "Validado" },
];

export interface OnboardingProjectDocument {
  id:           string;
  project_id:   string;
  label:        string;
  status:       OnboardingDocumentStatus;
  notes:        string | null;
  file_url:     string | null;
  storage_path: string | null;
  updated_by:   string | null;
  created_at:   string;
  updated_at:   string;
}

export type NewOnboardingProjectDocument = Pick<OnboardingProjectDocument, "label">;
export type UpdateOnboardingProjectDocument = Partial<Pick<OnboardingProjectDocument, "label" | "status" | "notes" | "file_url" | "storage_path">>;

export interface OnboardingHistoryEntry {
  id:               string;
  project_id:       string;
  actor_profile_id: string | null;
  actor_name?:      string | null;
  event_type:       string;
  payload:          Record<string, unknown>;
  created_at:       string;
}

export interface OnboardingNotificationPreferences {
  id:                       string;
  user_id:                  string;
  notify_on_assignment:     boolean;
  notify_on_status_change:  boolean;
  notify_deadline_reminder: boolean;
  reminder_advance_days:    number[];
  created_at:               string;
  updated_at:               string;
}

// Retorno de GET /api/workspace/onboarding/projects/[id]
export interface OnboardingProjectDetail extends OnboardingProject {
  client_name: string | null;
  status:      OnboardingProjectStatus;
  stages:      (OnboardingProjectStage & { tasks: OnboardingTask[] })[];
}

// Uma linha do painel de Equipe (workload).
export interface OnboardingTeamWorkloadRow {
  profile_id:      string;
  name:            string;
  tasks_total:     number;
  tasks_pending:   number;
  tasks_overdue:   number;
  tasks_completed: number;
}
