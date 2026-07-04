// Shared push notification dispatcher.
// Used by both the Agenda and CRM consumers — zero duplication.
//
// NOTE: actual web-push sending requires VAPID keys + `web-push` package.
// Until configured, calls are logged. See sendPushNotification() below.

import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

// ── Template renderer ─────────────────────────────────────────────────────────

/**
 * Replaces {{key}} placeholders with values from vars.
 * Unknown keys are left as-is (e.g. {{assigned_user}} if missing).
 */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => vars[key.trim()] ?? `{{${key.trim()}}}`);
}

// ── Low-level push sender (requires VAPID — see TODO below) ──────────────────

interface PushSubscriptionRow {
  endpoint: string;
  p256dh:   string;
  auth_key: string;
}

async function sendPushNotification(
  sub:   PushSubscriptionRow,
  title: string,
  body:  string,
): Promise<void> {
  // TODO: configure web-push once VAPID keys are available:
  //
  //   npm install web-push
  //   npm install --save-dev @types/web-push
  //
  // Then replace this log with:
  //   import webpush from "web-push";
  //   webpush.setVapidDetails(
  //     process.env.VAPID_SUBJECT!,          // "mailto:admin@genesy.com.br"
  //     process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  //     process.env.VAPID_PRIVATE_KEY!,
  //   );
  //   await webpush.sendNotification(
  //     { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
  //     JSON.stringify({ title, body, icon: "/favicon.png" }),
  //   );

  console.log("[push-dispatcher] would send to", sub.endpoint.slice(0, 50) + "…", "|", title);
  void body;
}

// ── Public dispatch function ──────────────────────────────────────────────────

/**
 * Sends a push notification to every active subscription of a user.
 * Failures are isolated per subscription — one bad sub doesn't block others.
 */
export async function dispatchPushToUser(
  db:     Db,
  userId: string,
  title:  string,
  body:   string,
): Promise<void> {
  const { data: subs } = await db
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth_key")
    .eq("user_id", userId);

  if (!subs?.length) return;

  await Promise.allSettled(
    subs.map(sub => sendPushNotification(sub as PushSubscriptionRow, title, body)),
  );
}
