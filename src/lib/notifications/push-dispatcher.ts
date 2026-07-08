import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";

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

let vapidConfigured = false;

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;

  const subject    = process.env.VAPID_SUBJECT;
  const publicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    console.warn("[push-dispatcher] VAPID env vars missing; push delivery skipped.");
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

async function sendPushNotification(
  sub:   PushSubscriptionRow,
  title: string,
  body:  string,
): Promise<void> {
  if (!ensureVapidConfigured()) return;

  await webpush.sendNotification(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
    JSON.stringify({ title, body, icon: "/favicon.png", tag: "genesy-workflow" }),
  );
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

  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await sendPushNotification(sub as PushSubscriptionRow, title, body);
      } catch (err) {
        const statusCode = typeof err === "object" && err !== null && "statusCode" in err
          ? Number((err as { statusCode?: number }).statusCode)
          : null;

        if (statusCode === 404 || statusCode === 410) {
          await db.from("push_subscriptions").delete().eq("endpoint", (sub as PushSubscriptionRow).endpoint);
        }

        throw err;
      }
    }),
  );

  const rejected = results.filter(r => r.status === "rejected");
  if (rejected.length > 0) {
    console.warn(`[push-dispatcher] ${rejected.length}/${results.length} push deliveries failed.`);
  }
}
