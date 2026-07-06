// ── Workspace — Tarefas / Preferências de notificação ─────────────────────────

export interface TaskNotificationPreferences {
  id:                       string;
  user_id:                  string;
  notify_on_assignment:     boolean;
  notify_on_status_change:  boolean;
  notify_on_completion:     boolean;
  notify_deadline_reminder: boolean;
  reminder_time:            string; // "HH:mm:ss"
  reminder_advance_days:    number[]; // 0 = no dia; 1/2/3/7 = dias antes
  created_at:               string;
  updated_at:               string;
}

export type UpdateTaskNotificationPreferences = Partial<Omit<TaskNotificationPreferences,
  "id" | "user_id" | "created_at" | "updated_at"
>>;

export const REMINDER_ADVANCE_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "No dia" },
  { value: 1, label: "1 dia antes" },
  { value: 2, label: "2 dias antes" },
  { value: 3, label: "3 dias antes" },
  { value: 7, label: "7 dias antes" },
];
