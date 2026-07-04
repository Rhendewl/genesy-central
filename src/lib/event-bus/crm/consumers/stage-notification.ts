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
      if (!payload?.stageId || !payload?.userId || !payload?.leadId) return;

      // 1. Find an enabled rule for this user + stage
      const { data: rule } = await db
        .from("crm_notification_rules")
        .select("channels, title, body")
        .eq("user_id",  payload.userId)
        .eq("stage_id", payload.stageId)
        .eq("enabled",  true)
        .maybeSingle();

      if (!rule) return;

      const channels = (rule.channels as string[]) ?? [];
      if (!channels.includes("pwa")) return;

      // 2. Load lead data for template vars (name, email, phone)
      const { data: lead } = await db
        .from("leads")
        .select("name, email, contact")
        .eq("id", payload.leadId)
        .maybeSingle();

      // 3. Load stage name + pipeline name (joined)
      const { data: stage } = await db
        .from("crm_stages")
        .select("name, color, crm_pipelines(name)")
        .eq("id", payload.stageId)
        .maybeSingle();

      const pipelineName = (stage?.crm_pipelines as { name?: string } | null)?.name ?? "";

      const vars: Record<string, string> = {
        pipeline_name: pipelineName,
        stage_name:    stage?.name  ?? "",
        lead_name:     lead?.name   ?? "",
        lead_email:    lead?.email  ?? "",
        lead_phone:    lead?.contact ?? "",
        assigned_user: "",
        created_at:    new Date().toLocaleDateString("pt-BR"),
      };

      const title = renderTemplate(rule.title as string, vars);
      const body  = renderTemplate(rule.body  as string, vars);

      await dispatchPushToUser(db, payload.userId, title, body);
    },
  };
}
