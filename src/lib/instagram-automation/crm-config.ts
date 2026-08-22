import type { SupabaseClient } from "@supabase/supabase-js";
import type { InstagramAutomationInput } from "./types";

export async function validateInstagramCrmReferences(
  db: SupabaseClient,
  organizationId: string,
  input: InstagramAutomationInput,
) {
  if (!input.crmEnabled) return;
  const [{ data: stage }, { data: origin }, { data: assignee }] = await Promise.all([
    db.from("crm_stages").select("id,pipeline_id,crm_pipelines!inner(user_id)")
      .eq("id", input.crmStageId!).eq("pipeline_id", input.crmPipelineId!).eq("crm_pipelines.user_id", organizationId).maybeSingle(),
    input.crmOriginId ? db.from("crm_lead_origins").select("id").eq("id", input.crmOriginId).eq("user_id", organizationId).maybeSingle() : Promise.resolve({ data: null }),
    input.crmAssignedTo ? db.from("user_profiles").select("id").eq("id", input.crmAssignedTo).eq("owner_id", organizationId).eq("is_active", true).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!stage) throw Object.assign(new Error("Pipeline ou etapa do CRM inválida"), { status: 400 });
  if (input.crmOriginId && !origin) throw Object.assign(new Error("Origem do CRM inválida"), { status: 400 });
  if (input.crmAssignedTo && !assignee) throw Object.assign(new Error("Responsável do CRM inválido"), { status: 400 });
}
