// Push Notification Consumer — subscribed to booking.created.
//
// Responsibilities:
//   1. Load the calendar's notification settings from the DB.
//   2. Check if push (PWA) channel is enabled.
//   3. Load the owner's push subscriptions.
//   4. Render the title/body templates against booking data.
//   5. Send push notification to each subscription.
//
// The Agenda module never references this file — it only publishes
// booking.created to the EventBus. Decoupling is enforced at the import level.
//
// NOTE — server-side push requires VAPID keys and the `web-push` npm package.
// Until those are configured, this consumer logs the rendered payload instead
// of actually sending. Wire up sendPushNotification() once ready.

import type { SupabaseClient }           from "@supabase/supabase-js";
import type { BusEvent }                 from "@/lib/event-bus/types";
import type { BookingCreatedPayload }    from "@/lib/event-bus/domain-events";
import { ConsumerPriority }              from "@/lib/event-bus/types";
import type { EventConsumer }            from "@/lib/event-bus/types";
import type { AppointmentNotificationSettings } from "@/types/appointments";

// ── Template renderer ─────────────────────────────────────────────────────────

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => vars[key.trim()] ?? `{{${key}}}`);
}

function buildVars(payload: BookingCreatedPayload): Record<string, string> {
  const d = new Date(payload.startsAt);
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });

  return {
    calendar_name:    payload.calendarName,
    lead_name:        payload.visitorName,
    lead_email:       payload.visitorEmail,
    lead_phone:       payload.visitorPhone ?? "",
    appointment_date: date,
    appointment_time: time,
    created_at:       new Date().toLocaleDateString("pt-BR"),
  };
}

// ── Web Push sender (placeholder — wire up with web-push package) ─────────────

interface PushSubscriptionRecord {
  endpoint: string;
  p256dh:   string;
  auth_key: string;
}

async function sendPushNotification(
  subscription: PushSubscriptionRecord,
  title: string,
  body:  string,
): Promise<void> {
  // TODO: Install `web-push` and configure VAPID keys via env vars:
  //   NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
  //   VAPID_PRIVATE_KEY=...
  //   VAPID_SUBJECT=mailto:admin@genesy.com.br
  //
  // Example:
  //   import webpush from "web-push";
  //   webpush.setVapidDetails(
  //     process.env.VAPID_SUBJECT!,
  //     process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  //     process.env.VAPID_PRIVATE_KEY!,
  //   );
  //   await webpush.sendNotification(
  //     { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } },
  //     JSON.stringify({ title, body, icon: "/favicon.png" }),
  //   );

  console.log("[push-notification] would send to", subscription.endpoint.slice(0, 60), "—", title);
  void body; // silence unused warning until TODO is resolved
}

// ── Consumer factory ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createPushNotificationConsumer(db: SupabaseClient<any, any, any>): EventConsumer {
  return {
    name:     "push-notification",
    priority: ConsumerPriority.NORMAL,
    events:   ["booking.created"],

    async handle(event: BusEvent): Promise<void> {
      const payload = event.payload as BookingCreatedPayload;
      if (!payload?.calendarId || !payload?.userId) return;

      // 1. Load calendar notification settings
      const { data: cal } = await db
        .from("appointment_calendars")
        .select("settings")
        .eq("id", payload.calendarId)
        .single();

      const notifSettings = cal?.settings?.notifications as AppointmentNotificationSettings | undefined;
      if (!notifSettings?.enabled) return;
      if (!notifSettings.channels.includes("pwa")) return;

      // 2. Load push subscriptions for this user
      const { data: subs } = await db
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth_key")
        .eq("user_id", payload.userId);

      if (!subs?.length) return;

      // 3. Render templates
      const vars  = buildVars(payload);
      const title = renderTemplate(notifSettings.title, vars);
      const body  = renderTemplate(notifSettings.body,  vars);

      // 4. Send to each subscription (best-effort; ignore individual failures)
      await Promise.allSettled(
        subs.map(sub => sendPushNotification(sub as PushSubscriptionRecord, title, body)),
      );
    },
  };
}
