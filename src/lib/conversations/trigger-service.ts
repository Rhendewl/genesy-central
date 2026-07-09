type Db = ReturnType<typeof import("@/lib/supabase-admin").createAdminSupabaseClient>;

type ConversationFlowRow = {
  id: string;
  user_id: string;
  owner_profile_id: string | null;
  scope: "team" | "personal";
  trigger_type: string;
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
    .select("id,user_id,owner_profile_id,scope,trigger_type")
    .eq("user_id", input.userId)
    .eq("status", "active")
    .eq("trigger_type", input.triggerType);

  if (error) {
    return { queued: 0, error: error.message };
  }

  const eligibleFlows = ((flows ?? []) as ConversationFlowRow[]).filter((flow) => {
    if (flow.scope === "team") return true;
    return flow.owner_profile_id && flow.owner_profile_id === input.ownerProfileId;
  });

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
