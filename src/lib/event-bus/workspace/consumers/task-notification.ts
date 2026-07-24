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
  taskId:      string,
  eventId:     string,
): Promise<void> {
  if (assigneeIds.length === 0) return;

  const { data: profiles, error: profilesError } = await db
    .from("user_profiles")
    .select("id, auth_user_id, owner_id")
    .in("id", assigneeIds);
  if (profilesError) throw new Error(`Erro ao resolver destinatários: ${profilesError.message}`);

  for (const p of (profiles ?? []) as { id: string; auth_user_id: string | null; owner_id: string }[]) {
    if (!p.auth_user_id) continue;
    if (p.auth_user_id === actorUserId) continue; // nunca notifica quem executou a própria ação

    const { data: prefs, error: preferencesError } = await db
      .from("workspace_task_notification_preferences")
      .select(prefKey)
      .eq("user_id", p.auth_user_id)
      .maybeSingle();
    if (preferencesError) throw new Error(`Erro ao consultar preferências: ${preferencesError.message}`);

    // Sem linha de preferências ainda => default é notificar (mantém o
    // comportamento padrão da tabela, que nasce com todos os switches ligados).
    if (prefs && (prefs as Record<PrefKey, boolean>)[prefKey] === false) continue;

    const actionUrl = `/workspace/kanban?task=${encodeURIComponent(taskId)}`;
    const { data: insertedInbox, error: inboxError } = await db
      .from("workflow_notifications")
      .insert({
        user_id:           p.owner_id,
        recipient_user_id: p.id,
        title,
        body,
        source:            "workspace_task",
        task_id:           taskId,
        action_url:        actionUrl,
        event_id:          eventId,
      })
      .select("id")
      .single();

    // Um retry do EventBus pode reencontrar o mesmo evento. O índice único
    // event_id+recipient evita duplicar o sino; outros erros devem ser refeitos.
    if (inboxError && inboxError.code !== "23505") {
      throw new Error(`Erro ao persistir notificação de tarefa: ${inboxError.message}`);
    }

    let notificationId = insertedInbox?.id as string | undefined;
    if (!notificationId && inboxError?.code === "23505") {
      const { data: existingInbox, error: existingInboxError } = await db
        .from("workflow_notifications")
        .select("id")
        .eq("event_id", eventId)
        .eq("recipient_user_id", p.id)
        .single();
      if (existingInboxError || !existingInbox?.id) {
        throw new Error(`Erro ao localizar notificação deduplicada: ${existingInboxError?.message ?? "registro ausente"}`);
      }
      notificationId = existingInbox.id as string;
    }
    if (!notificationId) throw new Error("Notificação persistida sem identificador.");

    let push;
    try {
      push = await dispatchPushToUser(db, p.auth_user_id, title, body, {
        tag: `workspace-task-${taskId}-${prefKey}`,
        url: actionUrl,
      });
    } catch (err) {
      await db.from("workflow_notifications").update({
        push_status:       "failed",
        push_error:        err instanceof Error ? err.message.slice(0, 1000) : "Erro desconhecido",
        push_attempted_at: new Date().toISOString(),
      }).eq("id", notificationId);
      throw err;
    }

    const pushStatus = push.skippedReason === "no_subscriptions"
      ? "no_subscription"
      : push.skippedReason === "vapid_not_configured"
        ? "not_configured"
        : push.failed === 0
          ? "accepted"
          : push.accepted > 0 ? "partial" : "failed";

    const { error: deliveryUpdateError } = await db.from("workflow_notifications").update({
      push_status:        pushStatus,
      push_subscriptions: push.subscriptions,
      push_accepted:      push.accepted,
      push_failed:        push.failed,
      push_removed:       push.removed,
      push_error:         push.skippedReason ?? null,
      push_attempted_at:  new Date().toISOString(),
    }).eq("id", notificationId);
    if (deliveryUpdateError) {
      throw new Error(`Erro ao registrar resultado do push: ${deliveryUpdateError.message}`);
    }

    console.log(
      `[task-notification] ${prefKey} -> profile=${p.id} inbox=ok push=${push.accepted}/${push.subscriptions}`
      + (push.skippedReason ? ` skipped=${push.skippedReason}` : ""),
    );
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

        await notifyAssignees(db, p.assigneeIds, p.actorUserId, "notify_on_assignment", title, body, p.taskId, event.id);
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

      await notifyAssignees(
        db,
        p.assigneeIds,
        p.actorUserId,
        isCompleted ? "notify_on_completion" : "notify_on_status_change",
        title,
        body,
        p.taskId,
        event.id,
      );
    },
  };
}
