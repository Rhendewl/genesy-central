import type { SupabaseClient } from "@supabase/supabase-js";
import { dispatchPushToUser } from "@/lib/notifications/push-dispatcher";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

type Recipient = { id: string; owner_id: string; auth_user_id: string };

export type OperationalAlertInput = {
  ownerUserId: string;
  roles: string[];
  eventId: string;
  source: string;
  title: string;
  body: string;
  actionUrl: string;
};

export async function persistOperationalAlert(db: Db, input: OperationalAlertInput) {
  const { data, error } = await db
    .from("user_profiles")
    .select("id,owner_id,auth_user_id")
    .eq("owner_id", input.ownerUserId)
    .eq("is_active", true)
    .in("role", input.roles)
    .not("auth_user_id", "is", null);
  if (error) throw new Error(`Erro ao consultar destinatários: ${error.message}`);

  let created = 0;
  let accepted = 0;
  let failed = 0;
  let noSubscription = 0;
  for (const recipient of (data ?? []) as Recipient[]) {
    const { data: notification, error: insertError } = await db.from("workflow_notifications").insert({
      user_id: recipient.owner_id,
      recipient_user_id: recipient.id,
      title: input.title,
      body: input.body,
      source: input.source,
      action_url: input.actionUrl,
      event_id: input.eventId,
    }).select("id").single();
    if (insertError?.code === "23505") continue;
    if (insertError || !notification) throw new Error(`Erro ao criar notificação: ${insertError?.message ?? "registro ausente"}`);
    created++;

    try {
      const push = await dispatchPushToUser(db, recipient.auth_user_id, input.title, input.body, {
        tag: input.eventId,
        url: input.actionUrl,
      });
      accepted += push.accepted;
      failed += push.failed;
      if (push.skippedReason === "no_subscriptions") noSubscription++;
      const pushStatus = push.skippedReason === "no_subscriptions"
        ? "no_subscription"
        : push.skippedReason === "vapid_not_configured"
          ? "not_configured"
          : push.failed === 0 ? "accepted" : push.accepted > 0 ? "partial" : "failed";
      await db.from("workflow_notifications").update({
        push_status: pushStatus,
        push_subscriptions: push.subscriptions,
        push_accepted: push.accepted,
        push_failed: push.failed,
        push_removed: push.removed,
        push_error: push.skippedReason ?? null,
        push_attempted_at: new Date().toISOString(),
      }).eq("id", notification.id);
    } catch (pushError) {
      failed++;
      await db.from("workflow_notifications").update({
        push_status: "failed",
        push_error: pushError instanceof Error ? pushError.message.slice(0, 1000) : "Erro desconhecido",
        push_attempted_at: new Date().toISOString(),
      }).eq("id", notification.id);
    }
  }
  return { recipients: data?.length ?? 0, created, accepted, failed, noSubscription };
}
