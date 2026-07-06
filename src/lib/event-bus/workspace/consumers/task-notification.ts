// Workspace Task Notification Consumer — subscribed to task.assigned,
// task.status_changed e task.completed.
//
// O Workspace nunca importa este arquivo — só publica os eventos no bus
// (POST /api/workspace/tasks e PATCH /api/workspace/tasks/[id]/move).
//
// assigneeIds no payload são workspace_task_assignees.assignee_id, ou seja,
// user_profiles.id — não o auth uid. Pra comparar com quem executou a ação
// (actorUserId, um auth uid) e pra checar preferências/disparar push (que
// esperam auth uid), resolve-se user_profiles.id -> auth_user_id aqui dentro,
// uma única vez, em vez de espalhar essa conversão pelos call sites.

import type { SupabaseClient } from "@supabase/supabase-js";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { BusEvent } from "@/lib/event-bus/types";
import { ConsumerPriority } from "@/lib/event-bus/types";
import type { EventConsumer } from "@/lib/event-bus/types";
import type { TaskAssignedPayload, TaskStatusChangedPayload } from "@/lib/event-bus/domain-events";
import { dispatchPushToUser } from "@/lib/notifications/push-dispatcher";
import { WORKSPACE_TASK_PRIORITIES, WORKSPACE_TASK_STATUSES } from "@/types/workspace";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

type PrefKey = "notify_on_assignment" | "notify_on_status_change" | "notify_on_completion";

async function resolveActorName(db: Db, actorUserId: string): Promise<string> {
  const { data: profile } = await db
    .from("user_profiles")
    .select("full_name")
    .eq("auth_user_id", actorUserId)
    .maybeSingle();
  if (profile?.full_name) return profile.full_name as string;

  const { data: company } = await db
    .from("company_profile")
    .select("owner_full_name")
    .eq("user_id", actorUserId)
    .maybeSingle();
  return (company?.owner_full_name as string | null) ?? "Alguém";
}

async function notifyAssignees(
  db:          Db,
  assigneeIds: string[],
  actorUserId: string,
  prefKey:     PrefKey,
  title:       string,
  body:        string,
): Promise<void> {
  if (assigneeIds.length === 0) return;

  const { data: profiles } = await db
    .from("user_profiles")
    .select("id, auth_user_id")
    .in("id", assigneeIds);

  for (const p of (profiles ?? []) as { id: string; auth_user_id: string }[]) {
    if (p.auth_user_id === actorUserId) continue; // nunca notifica quem executou a própria ação

    const { data: prefs } = await db
      .from("workspace_task_notification_preferences")
      .select(prefKey)
      .eq("user_id", p.auth_user_id)
      .maybeSingle();

    // Sem linha de preferências ainda => default é notificar (mantém o
    // comportamento padrão da tabela, que nasce com todos os switches ligados).
    if (prefs && (prefs as Record<PrefKey, boolean>)[prefKey] === false) continue;

    console.log(`[task-notification] ${prefKey} -> user_profiles.id=${p.id} auth_user_id=${p.auth_user_id} | ${title} | ${body}`);
    await dispatchPushToUser(db, p.auth_user_id, title, body);
  }
}

export function createTaskNotificationConsumer(db: Db): EventConsumer {
  return {
    name:     "workspace.task-notification",
    priority: ConsumerPriority.NORMAL,
    events:   ["task.assigned", "task.status_changed", "task.completed"],

    async handle(event: BusEvent): Promise<void> {
      if (event.type === "task.assigned") {
        const p = event.payload as TaskAssignedPayload;
        if (!p?.taskId || !p?.actorUserId) return;

        const priorityLabel = WORKSPACE_TASK_PRIORITIES.find((x) => x.id === p.priority)?.label ?? p.priority;
        const dueLabel = p.dueDate ? format(new Date(`${p.dueDate}T00:00:00`), "d MMM", { locale: ptBR }) : null;

        const title = "Nova tarefa atribuída";
        const body = `${p.taskTitle} • Prioridade ${priorityLabel}` + (dueLabel ? ` • Prazo ${dueLabel}` : "");

        await notifyAssignees(db, p.assigneeIds, p.actorUserId, "notify_on_assignment", title, body);
        return;
      }

      // task.status_changed e task.completed compartilham o mesmo payload —
      // só a preferência checada e o texto da mensagem diferem.
      const p = event.payload as TaskStatusChangedPayload;
      if (!p?.taskId || !p?.actorUserId) return;

      const isCompleted = event.type === "task.completed";
      const actorName = await resolveActorName(db, p.actorUserId);

      let title: string;
      let body: string;

      if (isCompleted) {
        title = "Tarefa concluída";
        body  = `${p.taskTitle} foi concluída por ${actorName}`;
      } else {
        const statusLabel = WORKSPACE_TASK_STATUSES.find((s) => s.id === p.toStatus)?.label ?? p.toStatus;
        title = "Tarefa movida";
        body  = `${p.taskTitle} foi movida para ${statusLabel} por ${actorName}`;
      }

      await notifyAssignees(db, p.assigneeIds, p.actorUserId, isCompleted ? "notify_on_completion" : "notify_on_status_change", title, body);
    },
  };
}
