import type { SupabaseClient } from "@supabase/supabase-js";
import { dispatchPushToUser } from "@/lib/notifications/push-dispatcher";
import type { PortalAccountBalance } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export const PORTAL_LOW_BALANCE_THRESHOLD_BRL = 200;

interface BalanceAlertState {
  ad_account_id: string;
  is_below_threshold: boolean;
  alert_sequence: number;
  last_alerted_at: string | null;
}

interface RecipientProfile {
  id: string;
  owner_id: string;
  auth_user_id: string;
}

export type BalanceAlertTransition = "alert" | "recover" | "unchanged" | "ignore";

export function getBalanceAlertTransition(
  balance: PortalAccountBalance,
  wasBelowThreshold: boolean | null,
  threshold = PORTAL_LOW_BALANCE_THRESHOLD_BRL,
): BalanceAlertTransition {
  const isEligible = balance.account_status === 1
    && balance.currency === "BRL"
    && balance.is_prepay
    && Number.isFinite(balance.balance_net);
  if (!isEligible) return "ignore";

  const isBelowThreshold = balance.balance_net < threshold;
  if (isBelowThreshold && wasBelowThreshold !== true) return "alert";
  if (!isBelowThreshold && wasBelowThreshold === true) return "recover";
  return "unchanged";
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

async function persistNotification(
  db: Db,
  recipient: RecipientProfile,
  eventId: string,
  title: string,
  body: string,
): Promise<void> {
  const actionUrl = "/portais";
  const { data: inserted, error: insertError } = await db
    .from("workflow_notifications")
    .insert({
      user_id: recipient.owner_id,
      recipient_user_id: recipient.id,
      title,
      body,
      source: "portal_balance",
      action_url: actionUrl,
      event_id: eventId,
    })
    .select("id")
    .single();

  // Outra consulta simultânea pode ter criado o mesmo alerta. Nesse caso o
  // índice event_id+recipient garante a deduplicação e não reenviamos o push.
  if (insertError?.code === "23505") return;
  if (insertError || !inserted?.id) {
    throw new Error(`Erro ao criar alerta de saldo: ${insertError?.message ?? "registro ausente"}`);
  }

  let push;
  try {
    push = await dispatchPushToUser(db, recipient.auth_user_id, title, body, {
      tag: eventId,
      url: actionUrl,
    });
  } catch (error) {
    await db.from("workflow_notifications").update({
      push_status: "failed",
      push_error: error instanceof Error ? error.message.slice(0, 1000) : "Erro desconhecido",
      push_attempted_at: new Date().toISOString(),
    }).eq("id", inserted.id);
    return;
  }

  const pushStatus = push.skippedReason === "no_subscriptions"
    ? "no_subscription"
    : push.skippedReason === "vapid_not_configured"
      ? "not_configured"
      : push.failed === 0
        ? "accepted"
        : push.accepted > 0 ? "partial" : "failed";

  await db.from("workflow_notifications").update({
    push_status: pushStatus,
    push_subscriptions: push.subscriptions,
    push_accepted: push.accepted,
    push_failed: push.failed,
    push_removed: push.removed,
    push_error: push.skippedReason ?? null,
    push_attempted_at: new Date().toISOString(),
  }).eq("id", inserted.id);
}

export async function processPortalBalanceAlerts(
  db: Db,
  input: {
    portalId: string;
    portalName: string;
    ownerUserId: string;
    balances: PortalAccountBalance[];
    threshold?: number;
  },
): Promise<{ alertsCreated: number }> {
  const threshold = input.threshold ?? PORTAL_LOW_BALANCE_THRESHOLD_BRL;
  const eligibleBalances = input.balances.filter(balance =>
    getBalanceAlertTransition(balance, null, threshold) !== "ignore",
  );
  if (eligibleBalances.length === 0) return { alertsCreated: 0 };

  const accountIds = eligibleBalances.map(balance => balance.account_id);
  const { data: stateRows, error: stateError } = await db
    .from("portal_balance_alert_states")
    .select("ad_account_id, is_below_threshold, alert_sequence, last_alerted_at")
    .eq("portal_id", input.portalId)
    .in("ad_account_id", accountIds);
  if (stateError) throw new Error(`Erro ao consultar estado do saldo: ${stateError.message}`);

  const stateByAccount = new Map(
    ((stateRows ?? []) as BalanceAlertState[]).map(state => [state.ad_account_id, state]),
  );
  const transitions = eligibleBalances.map(balance => {
    const previous = stateByAccount.get(balance.account_id);
    return {
      balance,
      previous,
      transition: getBalanceAlertTransition(balance, previous?.is_below_threshold ?? null, threshold),
    };
  });
  const crossings = transitions.filter(item => item.transition === "alert");

  let recipients: RecipientProfile[] = [];
  if (crossings.length > 0) {
    const { data, error } = await db
      .from("user_profiles")
      .select("id, owner_id, auth_user_id")
      .eq("owner_id", input.ownerUserId)
      .eq("is_active", true)
      .in("role", ["admin", "trafego"])
      .not("auth_user_id", "is", null);
    if (error) throw new Error(`Erro ao consultar destinatários do alerta: ${error.message}`);
    recipients = (data ?? []) as RecipientProfile[];
  }

  let alertsCreated = 0;
  for (const item of transitions) {
    // Sem destinatário ativo, não armamos o estado como já alertado: uma
    // próxima consulta poderá entregar o aviso depois que o acesso for criado.
    if (item.transition === "alert" && recipients.length === 0) continue;

    const isBelow = item.balance.balance_net < threshold;
    const nextSequence = item.transition === "alert"
      ? (item.previous?.alert_sequence ?? 0) + 1
      : item.previous?.alert_sequence ?? 0;

    if (item.transition === "alert" && recipients.length > 0) {
      const eventId = `portal-balance-low:${input.portalId}:${item.balance.account_id}:${nextSequence}`;
      const title = `Saldo de mídia abaixo de ${formatBRL(threshold)}`;
      const body = `${item.balance.account_name}, no portal ${input.portalName}, está com ${formatBRL(item.balance.balance_net)} disponíveis. Faça uma recarga para evitar a interrupção dos anúncios.`;

      await Promise.all(recipients.map(recipient =>
        persistNotification(db, recipient, eventId, title, body),
      ));
      alertsCreated++;
    }

    const stateUpdate = {
      portal_id: input.portalId,
      ad_account_id: item.balance.account_id,
      last_balance: item.balance.balance_net,
      is_below_threshold: isBelow,
      alert_sequence: nextSequence,
      ...(item.transition === "alert" ? { last_alerted_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    };
    const { error: upsertError } = await db.from("portal_balance_alert_states").upsert(
      stateUpdate,
      { onConflict: "portal_id,ad_account_id" },
    );
    if (upsertError) throw new Error(`Erro ao atualizar estado do saldo: ${upsertError.message}`);
  }

  return { alertsCreated };
}
