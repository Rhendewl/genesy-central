import { crmNotificationUrl } from "@/lib/crm/notification-url";
// CRM Stage Notification Consumer — subscribed to lead.stage.entered.
//
// Checks if the user has a notification rule for the entered stage.
// If so, loads lead data, renders the template, and dispatches push.
//
// The CRM module never references this file — it only publishes
// lead.stage.entered to the EventBus. Decoupling is enforced at the import level.

import type { SupabaseClient }         from "@supabase/supabase-js";
import type { BusEvent }               from "@/lib/event-bus/types";
import type { LeadStageEnteredPayload } from "@/lib/event-bus/domain-events";
import { ConsumerPriority }            from "@/lib/event-bus/types";
import type { EventConsumer }          from "@/lib/event-bus/types";
import { renderTemplate, dispatchPushToUser } from "@/lib/notifications/push-dispatcher";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export function createCrmStageNotificationConsumer(db: Db): EventConsumer {
  return {
    name:     "crm.stage-notification",
    priority: ConsumerPriority.NORMAL,
    events:   ["lead.stage.entered"],

    async handle(event: BusEvent): Promise<void> {
      const payload = event.payload as LeadStageEnteredPayload;
      if (!payload?.stageId || !payload?.leadId) return;

      // O ator que moveu o lead pode ser um membro da equipe. A regra e a
      // inscrição push pertencem ao dono real do CRM, armazenado em leads.user_id.
      const { data: lead } = await db
        .from("leads")
        .select("name, email, contact, user_id, assigned_to")
        .eq("id", payload.leadId)
        .maybeSingle();
      if (!lead?.user_id) return;

      // 1. Regra da etapa (configurada na central de notificações).
      const { data: rule } = await db
        .from("crm_notification_rules")
        .select("channels, title, body, enabled")
        .eq("user_id",  lead.user_id)
        .eq("stage_id", payload.stageId)
        .maybeSingle();

      // Sem regra: todo lead que CHEGA numa pipeline avisa o responsável por padrão,
      // sem precisar configurar nada. Regra desligada = silêncio.
      const isArrival = payload.fromStageId == null;
      if (rule && !rule.enabled) return;
      if (!rule && !isArrival) return;
      const channels = rule ? ((rule.channels as string[]) ?? []) : ["pwa"];
      if (!channels.includes("pwa")) return;

      // 3. Load stage name + pipeline name (joined)
      const { data: stage } = await db
        .from("crm_stages")
        .select("name, color, crm_pipelines(name, default_assignee_id)")
        .eq("id", payload.stageId)
        .maybeSingle();

      const pipeline = stage?.crm_pipelines as { name?: string; default_assignee_id?: string | null } | null;
      const pipelineName = pipeline?.name ?? "";

      // Responsável: quem está com o lead; se ninguém, o responsável da pipeline.
      const responsibleId = (lead.assigned_to as string | null) ?? pipeline?.default_assignee_id ?? null;
      const { data: assignee } = responsibleId
        ? await db.from("user_profiles").select("auth_user_id,is_active,full_name").eq("id", responsibleId).eq("owner_id", lead.user_id).maybeSingle()
        : { data: null };

      const vars: Record<string, string> = {
        pipeline_name: pipelineName,
        stage_name:    stage?.name  ?? "",
        lead_name:     lead?.name   ?? "",
        lead_email:    lead?.email  ?? "",
        lead_phone:    lead?.contact ?? "",
        assigned_user: (assignee?.full_name as string | undefined) ?? "",
        created_at:    new Date().toLocaleDateString("pt-BR"),
      };

      const title = renderTemplate(rule ? rule.title as string : "Novo Lead • {{lead_name}}", vars);
      const body  = renderTemplate(rule ? rule.body as string : "{{lead_name}} está esperando seu contato!", vars);

      // Destinatários: com regra, o dono da conta e o responsável; no aviso padrão, só o responsável.
      const recipients = new Set<string>(rule ? [lead.user_id as string] : []);
      const responsibleAuth = assignee?.is_active ? (assignee.auth_user_id as string | null) : null;
      // Quem cadastrou o próprio lead não precisa ser avisado.
      if (responsibleAuth && !(isArrival && !rule && responsibleAuth === payload.userId)) recipients.add(responsibleAuth);
      if (!recipients.size) return;
      const results = await Promise.allSettled(Array.from(recipients).map(userId => dispatchPushToUser(db, userId, title, body, {
        tag: `crm-stage-${event.id}`,
        url: crmNotificationUrl(payload.pipelineId,payload.leadId),
      })));
      results.forEach(r => { if (r.status === "rejected") console.error("[crm.stage-notification] Falha ao enviar push", r.reason); });
    },
  };
}
