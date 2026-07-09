type Db = ReturnType<typeof import("@/lib/supabase-admin").createAdminSupabaseClient>;

type ConversationFlowRow = {
  id: string;
  user_id: string;
  owner_profile_id: string | null;
  scope: "team" | "personal";
  trigger_type: string;
  trigger_config: Record<string, unknown> | null;
};

export interface EnqueueConversationTriggerInput {
  userId: string;
  triggerType: string;
  threadId?: string | null;
  whatsappAccountId?: string | null;
  ownerProfileId?: string | null;
  leadId?: string | null;
  snapshot?: Record<string, unknown>;
}

export async function enqueueConversationTrigger(
  db: Db,
  input: EnqueueConversationTriggerInput,
) {
  const { data: flows, error } = await db
    .from("conversation_flows")
    .select("id,user_id,owner_profile_id,scope,trigger_type,trigger_config")
    .eq("user_id", input.userId)
    .eq("status", "active")
    .eq("trigger_type", input.triggerType);

  if (error) {
    return { queued: 0, error: error.message };
  }

  const eligibleFlows = ((flows ?? []) as ConversationFlowRow[]).filter((flow) => {
    if (flow.scope === "team") return true;
    return flow.owner_profile_id && flow.owner_profile_id === input.ownerProfileId;
  }).filter((flow) => matchesTriggerConfig(flow.trigger_config ?? {}, input.snapshot ?? {}));

  if (eligibleFlows.length === 0) {
    return { queued: 0, error: null };
  }

  const now = new Date().toISOString();
  const jobs = eligibleFlows.map((flow) => ({
    user_id: input.userId,
    flow_id: flow.id,
    lead_id: input.leadId ?? null,
    thread_id: input.threadId ?? null,
    whatsapp_account_id: input.whatsappAccountId ?? null,
    owner_profile_id: input.ownerProfileId ?? null,
    status: "pending",
    scheduled_for: now,
    trigger_event_type: input.triggerType,
    trigger_snapshot: input.snapshot ?? {},
  }));

  const { error: insertError } = await db
    .from("conversation_flow_jobs")
    .insert(jobs);

  if (insertError) {
    return { queued: 0, error: insertError.message };
  }

  return { queued: jobs.length, error: null };
}

function snapshotString(snapshot: Record<string, unknown>, key: string) {
  const value = snapshot[key];
  return typeof value === "string" ? value : String(value ?? "");
}

function matchesId(config: Record<string, unknown>, snapshot: Record<string, unknown>, configKey: string, snapshotKey: string) {
  const expected = typeof config[configKey] === "string" ? config[configKey] as string : "";
  if (!expected) return true;
  return snapshotString(snapshot, snapshotKey) === expected;
}

function matchesMessage(config: Record<string, unknown>, snapshot: Record<string, unknown>) {
  const expected = typeof config.message_value === "string" ? config.message_value.trim().toLowerCase() : "";
  const operator = typeof config.message_operator === "string" ? config.message_operator : "contains";
  const actual = snapshotString(snapshot, "message_body").toLowerCase();

  if (operator === "not_empty") return actual.trim().length > 0;
  if (!expected) return true;
  if (operator === "equals") return actual === expected;
  if (operator === "not_contains") return !actual.includes(expected);
  return actual.includes(expected);
}

function matchesTriggerConfig(config: Record<string, unknown>, snapshot: Record<string, unknown>) {
  if (!matchesId(config, snapshot, "form_id", "form_id")) return false;
  if (!matchesId(config, snapshot, "calendar_id", "calendar_id")) return false;
  if (!matchesId(config, snapshot, "pipeline_id", "pipeline_id")) return false;
  if (!matchesId(config, snapshot, "stage_id", "stage_id")) return false;

  if (config.skip_when_scheduled !== false && snapshot.has_scheduled_booking === true) {
    return false;
  }

  if (config.message_value || config.message_operator) {
    return matchesMessage(config, snapshot);
  }

  return true;
}
