// Onboarding Notification Consumer — subscrito a onboarding.task_assigned e
// onboarding.comment_added. Mesmo formato do consumer de Workspace Tasks
// (task-notification.ts): checa onboarding_notification_preferences por
// destinatário, nunca notifica quem executou a própria ação, despacha via
// dispatchPushToUser (mesma limitação atual de stub sem env VAPID).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusEvent } from "@/lib/event-bus/types";
import { ConsumerPriority } from "@/lib/event-bus/types";
import type { EventConsumer } from "@/lib/event-bus/types";
import type { OnboardingCommentAddedPayload, OnboardingTaskAssignedPayload } from "@/lib/event-bus/domain-events";
import { dispatchPushToUser } from "@/lib/notifications/push-dispatcher";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

type PrefKey = "notify_on_assignment" | "notify_on_status_change";

async function notifyProfile(
  db:          Db,
  profileId:   string,
  actorUserId: string,
  prefKey:     PrefKey,
  title:       string,
  body:        string,
): Promise<void> {
  const { data: profile } = await db.from("user_profiles").select("auth_user_id").eq("id", profileId).maybeSingle();
  const authUserId = profile?.auth_user_id as string | undefined;
  if (!authUserId || authUserId === actorUserId) return;

  const { data: prefs } = await db
    .from("onboarding_notification_preferences")
    .select(prefKey)
    .eq("user_id", authUserId)
    .maybeSingle();

  if (prefs && (prefs as Record<PrefKey, boolean>)[prefKey] === false) return;

  await dispatchPushToUser(db, authUserId, title, body);
}

export function createOnboardingNotificationConsumer(db: Db): EventConsumer {
  return {
    name:     "onboarding.notification",
    priority: ConsumerPriority.NORMAL,
    events:   ["onboarding.task_assigned", "onboarding.comment_added"],

    async handle(event: BusEvent): Promise<void> {
      if (event.type === "onboarding.task_assigned") {
        const p = event.payload as OnboardingTaskAssignedPayload;
        if (!p?.taskId || !p?.assigneeProfileId || !p?.actorUserId) return;

        await notifyProfile(
          db, p.assigneeProfileId, p.actorUserId, "notify_on_assignment",
          "Nova tarefa de onboarding",
          `${p.taskTitle} • ${p.projectName}`,
        );
        return;
      }

      const p = event.payload as OnboardingCommentAddedPayload;
      if (!p?.taskId || !p?.actorUserId) return;

      const { data: task } = await db.from("onboarding_tasks").select("title, assignee_profile_id").eq("id", p.taskId).maybeSingle();
      if (!task?.assignee_profile_id) return;

      await notifyProfile(
        db, task.assignee_profile_id, p.actorUserId, "notify_on_status_change",
        "Novo comentário",
        `Comentário em "${task.title}"`,
      );
    },
  };
}
