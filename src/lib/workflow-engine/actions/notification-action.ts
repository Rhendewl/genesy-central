import type { ActionExecutor, ActionExecContext, ActionExecResult } from "../types";
import { renderWorkflowTemplate } from "../variables";
import { dispatchPushToUser } from "@/lib/notifications/push-dispatcher";

// ─────────────────────────────────────────────────────────────────────────────
// core.notification.create — única ação da Fase 1. Domínio-agnóstica: só
// depende de ctx.recordId + ctx.variables, nunca de "lead"/"pipeline"
// diretamente (a resolução de quem é o "responsável atual" é feita aqui via
// leads.assigned_to, que é o único ponto CRM-específico deste arquivo —
// aceitável porque a ação em si (registrar uma notificação + tentar push)
// é genérica; um módulo futuro que reusar esta action só precisa que
// ctx.recordId aponte pra uma linha com um "owner" resolvível do mesmo jeito).
// ─────────────────────────────────────────────────────────────────────────────

export interface NotificationActionConfig {
  title:            string;
  body:             string;
  recipientType:    "lead_owner" | "specific_user" | "admins";
  recipientUserId?: string; // user_profiles.id — obrigatório quando recipientType === "specific_user"
}

async function resolveRecipientProfileIds(
  ctx: ActionExecContext,
  config: NotificationActionConfig,
): Promise<string[]> {
  if (config.recipientType === "specific_user") {
    return config.recipientUserId ? [config.recipientUserId] : [];
  }

  if (config.recipientType === "lead_owner") {
    const { data: lead } = await ctx.db
      .from("leads")
      .select("assigned_to")
      .eq("id", ctx.recordId)
      .maybeSingle();
    const assignedTo = (lead as { assigned_to?: string | null } | null)?.assigned_to;
    return assignedTo ? [assignedTo] : [];
  }

  // admins: todo user_profiles ativo com role='admin' do mesmo dono de conta
  // do lead (leads.user_id === user_profiles.owner_id).
  const { data: lead } = await ctx.db.from("leads").select("user_id").eq("id", ctx.recordId).maybeSingle();
  const ownerId = (lead as { user_id?: string } | null)?.user_id;
  if (!ownerId) return [];

  const { data: admins } = await ctx.db
    .from("user_profiles")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("role", "admin")
    .eq("is_active", true);
  return ((admins as { id: string }[]) ?? []).map(a => a.id);
}

export const notificationAction: ActionExecutor = {
  type: "core.notification.create",

  async execute(ctx: ActionExecContext, rawConfig: Record<string, unknown>): Promise<ActionExecResult> {
    const config = rawConfig as unknown as NotificationActionConfig;

    const recipientIds = await resolveRecipientProfileIds(ctx, config);
    if (recipientIds.length === 0) {
      return { ok: false, error: "Nenhum destinatário resolvido (lead sem responsável atribuído?)" };
    }

    const title = renderWorkflowTemplate(config.title, ctx.variables);
    const body  = renderWorkflowTemplate(config.body,  ctx.variables);

    const { data: profiles, error: profilesError } = await ctx.db
      .from("user_profiles")
      .select("id, auth_user_id")
      .in("id", recipientIds);
    if (profilesError) return { ok: false, error: `Erro ao resolver destinatários: ${profilesError.message}` };

    const rows = recipientIds.map(recipientId => ({
      user_id:           ctx.userId,
      recipient_user_id: recipientId,
      job_id:            ctx.jobId,
      automation_id:     ctx.automationId,
      lead_id:           ctx.recordId,
      title,
      body,
      source:            "workflow",
      action_url:        "/crm",
    }));

    const { data: inserted, error } = await ctx.db
      .from("workflow_notifications")
      .insert(rows)
      .select("id, recipient_user_id");
    if (error) return { ok: false, error: error.message };

    const authByProfile = new Map(
      ((profiles as { id: string; auth_user_id: string | null }[]) ?? []).map(profile => [profile.id, profile.auth_user_id]),
    );

    await Promise.all(((inserted as { id: string; recipient_user_id: string }[]) ?? []).map(async notification => {
      const authUserId = authByProfile.get(notification.recipient_user_id);
      if (!authUserId) {
        await ctx.db.from("workflow_notifications").update({
          push_status: "failed",
          push_error: "Perfil sem vínculo de autenticação",
          push_attempted_at: new Date().toISOString(),
        }).eq("id", notification.id);
        return;
      }

      try {
        const push = await dispatchPushToUser(ctx.db, authUserId, title, body, {
          tag: `crm-workflow-${ctx.automationId}-${ctx.recordId}`,
          url: "/crm",
        });
        const pushStatus = push.skippedReason === "no_subscriptions"
          ? "no_subscription"
          : push.skippedReason === "vapid_not_configured"
            ? "not_configured"
            : push.failed === 0 ? "accepted" : push.accepted > 0 ? "partial" : "failed";

        await ctx.db.from("workflow_notifications").update({
          push_status: pushStatus,
          push_subscriptions: push.subscriptions,
          push_accepted: push.accepted,
          push_failed: push.failed,
          push_removed: push.removed,
          push_error: push.skippedReason ?? null,
          push_attempted_at: new Date().toISOString(),
        }).eq("id", notification.id);
      } catch (pushError) {
        await ctx.db.from("workflow_notifications").update({
          push_status: "failed",
          push_error: pushError instanceof Error ? pushError.message.slice(0, 1000) : "Erro desconhecido",
          push_attempted_at: new Date().toISOString(),
        }).eq("id", notification.id);
      }
    }));

    return { ok: true, renderedSnapshot: { title, body, recipientType: config.recipientType, recipientIds } };
  },
};
