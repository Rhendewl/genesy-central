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

      // 1. Find an enabled rule for the CRM owner + stage
      const { data: rule } = await db
        .from("crm_notification_rules")
        .select("channels, title, body")
        .eq("user_id",  lead.user_id)
        .eq("stage_id", payload.stageId)
        .eq("enabled",  true)
        .maybeSingle();

      if (!rule) return;

      const channels = (rule.channels as string[]) ?? [];
      if (!channels.includes("pwa")) return;

      // 3. Load stage name + pipeline name (joined)
      const { data: stage } = await db
        .from("crm_stages")
        .select("name, color, crm_pipelines(name)")
        .eq("id", payload.stageId)
        .maybeSingle();

      const pipelineName = (stage?.crm_pipelines as { name?: string } | null)?.name ?? "";

      const { data: assignee } = lead.assigned_to
        ? await db.from("user_profiles").select("auth_user_id,is_active,full_name").eq("id", lead.assigned_to).eq("owner_id", lead.user_id).maybeSingle()
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

      const title = renderTemplate(rule.title as string, vars);
      const body  = renderTemplate(rule.body  as string, vars);

      // Destinatários: o dono da conta e o corretor responsável pelo lead (ex.: quem recebeu pela roleta).
      const recipients = new Set<string>([lead.user_id as string]);
      if (assignee?.auth_user_id && assignee.is_active) recipients.add(assignee.auth_user_id as string);
      const results = await Promise.allSettled(Array.from(recipients).map(userId => dispatchPushToUser(db, userId, title, body, {
        tag: `crm-stage-${event.id}`,
        url: crmNotificationUrl(payload.pipelineId,payload.leadId),
      })));
      results.forEach(r => { if (r.status === "rejected") console.error("[crm.stage-notification] Falha ao enviar push", r.reason); });
    },
  };
}
