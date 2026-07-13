import type { SupabaseClient } from "@supabase/supabase-js";
import { dispatchPushToUser } from "@/lib/notifications/push-dispatcher";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

interface PreferenceRow {
  user_id:                  string;
  notify_deadline_reminder: boolean;
  reminder_time:            string;
  reminder_advance_days:    number[];
}

interface ProfileRow {
  id:       string;
  owner_id: string;
}

interface WorkspaceTaskReminderRow {
  id:       string;
  user_id:  string;
  title:    string;
  due_date: string | null;
  due_time: string | null;
  status:   string;
}

interface TaskAssigneeRow {
  task_id:     string;
  assignee_id: string;
}

export interface DeadlineReminderResult {
  checked_users: number;
  checked_tasks: number;
  sent:          number;
  skipped:       number;
  errors:        string[];
}

const DEFAULT_TIMEZONE = "America/Sao_Paulo";

function localDateKey(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: timezone }).format(date).slice(0, 10);
}

function localMinutes(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour:     "2-digit",
    minute:   "2-digit",
    hour12:   false,
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function timeToMinutes(time: string): number {
  const [hour, minute] = time.slice(0, 5).split(":").map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDueDate(dateKey: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    .format(new Date(`${dateKey}T00:00:00.000Z`));
}

function reminderTitle(advanceDays: number): string {
  if (advanceDays === 0) return "Tarefa vence hoje";
  if (advanceDays === 1) return "Tarefa vence amanhã";
  return `Tarefa vence em ${advanceDays} dias`;
}

function reminderBody(task: WorkspaceTaskReminderRow): string {
  const dueTime = task.due_time ? ` às ${task.due_time.slice(0, 5)}` : "";
  return `${task.title} • Prazo ${formatDueDate(task.due_date!)}${dueTime}`;
}

async function getProfile(db: Db, userId: string): Promise<ProfileRow | null> {
  const { data } = await db
    .from("user_profiles")
    .select("id, owner_id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  return (data as ProfileRow | null) ?? null;
}

async function getTimezone(db: Db, userId: string, profile: ProfileRow | null): Promise<string> {
  const ownerId = profile?.owner_id ?? userId;
  const { data } = await db
    .from("company_profile")
    .select("timezone")
    .eq("user_id", ownerId)
    .maybeSingle();

  return (data?.timezone as string | null) ?? DEFAULT_TIMEZONE;
}

async function getAssignedTaskIds(db: Db, profileId: string | null): Promise<Set<string>> {
  if (!profileId) return new Set();

  const { data } = await db
    .from("workspace_task_assignees")
    .select("task_id")
    .eq("assignee_id", profileId);

  return new Set((data ?? []).map((row) => row.task_id as string));
}

async function getTaskAssignees(db: Db, taskIds: string[]): Promise<Map<string, string[]>> {
  if (taskIds.length === 0) return new Map();

  const { data } = await db
    .from("workspace_task_assignees")
    .select("task_id, assignee_id")
    .in("task_id", taskIds);

  const map = new Map<string, string[]>();
  for (const row of (data ?? []) as TaskAssigneeRow[]) {
    const list = map.get(row.task_id) ?? [];
    list.push(row.assignee_id);
    map.set(row.task_id, list);
  }
  return map;
}

async function markReminder(db: Db, taskId: string, userId: string, reminderDate: string, dueDate: string, advanceDays: number): Promise<boolean> {
  const { error } = await db
    .from("workspace_task_deadline_notification_deliveries")
    .insert({
      task_id:       taskId,
      user_id:       userId,
      reminder_date: reminderDate,
      due_date:      dueDate,
      advance_days:  advanceDays,
    });

  if (!error) return true;
  if (error.code === "23505") return false;
  throw new Error(error.message);
}

export async function runWorkspaceTaskDeadlineReminders(db: Db, now = new Date()): Promise<DeadlineReminderResult> {
  const result: DeadlineReminderResult = {
    checked_users: 0,
    checked_tasks: 0,
    sent:          0,
    skipped:       0,
    errors:        [],
  };

  const { data: preferences, error: prefsError } = await db
    .from("workspace_task_notification_preferences")
    .select("user_id, notify_deadline_reminder, reminder_time, reminder_advance_days")
    .eq("notify_deadline_reminder", true);

  if (prefsError) throw new Error(prefsError.message);

  for (const pref of (preferences ?? []) as PreferenceRow[]) {
    result.checked_users++;

    try {
      const profile = await getProfile(db, pref.user_id);
      const timezone = await getTimezone(db, pref.user_id, profile);
      const reminderMinutes = timeToMinutes(pref.reminder_time);
      if (localMinutes(now, timezone) < reminderMinutes) {
        result.skipped++;
        continue;
      }

      const reminderDate = localDateKey(now, timezone);
      const assignedTaskIds = await getAssignedTaskIds(db, profile?.id ?? null);
      const advanceDays = Array.from(new Set(pref.reminder_advance_days ?? [])).filter((d) => d >= 0);

      for (const advanceDay of advanceDays) {
        const dueDate = addDays(reminderDate, advanceDay);
        let query = db
          .from("workspace_tasks")
          .select("id, user_id, title, due_date, due_time, status")
          .eq("due_date", dueDate)
          .neq("status", "concluido");

        if (assignedTaskIds.size > 0) {
          query = query.or(`user_id.eq.${pref.user_id},id.in.(${Array.from(assignedTaskIds).join(",")})`);
        } else {
          query = query.eq("user_id", pref.user_id);
        }

        const { data: tasks, error: tasksError } = await query;
        if (tasksError) throw new Error(tasksError.message);

        const rows = (tasks ?? []) as WorkspaceTaskReminderRow[];
        result.checked_tasks += rows.length;

        const assigneesByTask = await getTaskAssignees(db, rows.map((task) => task.id));

        for (const task of rows) {
          const assignees = assigneesByTask.get(task.id) ?? [];
          const shouldNotify = profile?.id
            ? assignees.includes(profile.id) || (task.user_id === pref.user_id && assignees.length === 0)
            : task.user_id === pref.user_id && assignees.length === 0;

          if (!shouldNotify) {
            result.skipped++;
            continue;
          }

          const shouldSend = await markReminder(db, task.id, pref.user_id, reminderDate, dueDate, advanceDay);
          if (!shouldSend) {
            result.skipped++;
            continue;
          }

          await dispatchPushToUser(db, pref.user_id, reminderTitle(advanceDay), reminderBody(task));
          result.sent++;
        }
      }
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : "Erro desconhecido");
    }
  }

  return result;
}
