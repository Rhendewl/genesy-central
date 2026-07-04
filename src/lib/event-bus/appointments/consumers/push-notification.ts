// Push Notification Consumer — subscribed to booking.created.
//
// Reads the calendar's notification settings, renders the template,
// and dispatches to the user's push subscriptions via the shared dispatcher.

import type { SupabaseClient }                  from "@supabase/supabase-js";
import type { BusEvent }                        from "@/lib/event-bus/types";
import type { BookingCreatedPayload }           from "@/lib/event-bus/domain-events";
import { ConsumerPriority }                     from "@/lib/event-bus/types";
import type { EventConsumer }                   from "@/lib/event-bus/types";
import type { AppointmentNotificationSettings } from "@/types/appointments";
import { renderTemplate, dispatchPushToUser }   from "@/lib/notifications/push-dispatcher";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

function buildVars(payload: BookingCreatedPayload): Record<string, string> {
  const d    = new Date(payload.startsAt);
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

export function createPushNotificationConsumer(db: Db): EventConsumer {
  return {
    name:     "appointments.push-notification",
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

      // 2. Render templates
      const vars  = buildVars(payload);
      const title = renderTemplate(notifSettings.title, vars);
      const body  = renderTemplate(notifSettings.body,  vars);

      // 3. Dispatch to all user push subscriptions
      await dispatchPushToUser(db, payload.userId, title, body);
    },
  };
}
