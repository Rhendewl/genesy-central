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

    const { data: profiles } = await ctx.db
      .from("user_profiles")
      .select("id, auth_user_id")
      .in("id", recipientIds);

    const rows = recipientIds.map(recipientId => ({
      user_id:           ctx.userId,
      recipient_user_id: recipientId,
      job_id:            ctx.jobId,
      automation_id:     ctx.automationId,
      lead_id:           ctx.recordId,
      title,
      body,
    }));

    const { error } = await ctx.db.from("workflow_notifications").insert(rows);
    if (error) return { ok: false, error: error.message };

    // Best-effort — push real ainda é um stub sem chaves VAPID (limitação
    // pré-existente de src/lib/notifications/push-dispatcher.ts).
    const authUserIds = ((profiles as { id: string; auth_user_id: string | null }[]) ?? [])
      .map(p => p.auth_user_id)
      .filter((id): id is string => !!id);
    await Promise.allSettled(authUserIds.map(uid => dispatchPushToUser(ctx.db, uid, title, body)));

    return { ok: true, renderedSnapshot: { title, body, recipientType: config.recipientType, recipientIds } };
  },
};
