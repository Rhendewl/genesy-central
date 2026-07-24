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

export interface PushDispatchResult {
  subscriptions: number;
  accepted:      number;
  failed:        number;
  removed:       number;
  skippedReason?: "no_subscriptions" | "vapid_not_configured";
}

export interface PushNotificationOptions {
  icon?: string;
  tag?:  string;
  url?:  string;
}

let vapidConfigured = false;

function ensureVapidConfigured(): boolean {
  const subject    = process.env.VAPID_SUBJECT;
  const publicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    console.warn("[push-dispatcher] VAPID env vars missing; push delivery skipped.");
    return false;
  }

  if (vapidConfigured) return true;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

async function sendPushNotification(
  sub:   PushSubscriptionRow,
  title: string,
  body:  string,
  options: PushNotificationOptions,
): Promise<void> {
  await webpush.sendNotification(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
    JSON.stringify({
      title,
      body,
      icon: options.icon ?? "/favicon.png",
      tag:  options.tag ?? "genesy-workflow",
      url:  options.url ?? "/",
    }),
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
  options: PushNotificationOptions = {},
): Promise<PushDispatchResult> {
  const { data: subs, error: subscriptionsError } = await db
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth_key")
    .eq("user_id", userId);

  if (subscriptionsError) throw new Error(`Erro ao buscar dispositivos: ${subscriptionsError.message}`);
  if (!subs?.length) {
    return { subscriptions: 0, accepted: 0, failed: 0, removed: 0, skippedReason: "no_subscriptions" };
  }
  if (!ensureVapidConfigured()) {
    return {
      subscriptions: subs.length,
      accepted: 0,
      failed: 0,
      removed: 0,
      skippedReason: "vapid_not_configured",
    };
  }

  let removed = 0;

  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await sendPushNotification(sub as PushSubscriptionRow, title, body, options);
      } catch (err) {
        const statusCode = typeof err === "object" && err !== null && "statusCode" in err
          ? Number((err as { statusCode?: number }).statusCode)
          : null;

        if (statusCode === 404 || statusCode === 410) {
          await db.from("push_subscriptions").delete().eq("endpoint", (sub as PushSubscriptionRow).endpoint);
          removed++;
        }

        throw err;
      }
    }),
  );

  const rejected = results.filter(r => r.status === "rejected");
  if (rejected.length > 0) {
    console.warn(`[push-dispatcher] ${rejected.length}/${results.length} push deliveries failed.`);
  }

  return {
    subscriptions: results.length,
    accepted: results.length - rejected.length,
    failed: rejected.length,
    removed,
  };
}
