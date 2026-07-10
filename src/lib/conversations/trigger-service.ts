type Db = ReturnType<typeof import("@/lib/supabase-admin").createAdminSupabaseClient>;

type ConversationFlowRow = {
  id: string;
  user_id: string;
  owner_profile_id: string | null;
  scope: "team" | "personal";
  trigger_type: string;
  trigger_config: Record<string, unknown> | null;
};

type FlowNodeRow = {
  id: string;
  node_key: string;
  node_type: string;
  label: string;
  config: Record<string, unknown>;
};

type FlowEdgeRow = {
  source_key: string;
  target_key: string;
};

// Congela { nodes, edges } de um fluxo no momento em que o job é criado —
// evita que um job em espera passe a ler um grafo editado depois que a
// execução já começou (ver flow-executor.ts, que prioriza este snapshot
// sobre a consulta ao vivo quando presente).
export async function loadGraphSnapshot(db: Db, flowId: string) {
  const [{ data: nodes }, { data: edges }] = await Promise.all([
    db
      .from("conversation_flow_nodes")
      .select("id,node_key,node_type,label,config")
      .eq("flow_id", flowId)
      .order("created_at", { ascending: true }),
    db
      .from("conversation_flow_edges")
      .select("source_key,target_key")
      .eq("flow_id", flowId)
      .order("created_at", { ascending: true }),
  ]);

  return {
    nodes: (nodes ?? []) as FlowNodeRow[],
    edges: (edges ?? []) as FlowEdgeRow[],
  };
}

export interface EnqueueConversationTriggerInput {
  userId: string;
  triggerType: string;
  threadId?: string | null;
  whatsappAccountId?: string | null;
  ownerProfileId?: string | null;
  leadId?: string | null;
  snapshot?: Record<string, unknown>;
  // Chave estável do evento de origem (ex.: `message:<id>`, `submission:<id>`,
  // `event:<busEventId>`). Junto com flow_id, garante que um retry do EventBus
  // ou uma reentrega de webhook não crie um segundo job para a mesma
  // ocorrência — ver índice único parcial em conversation_flow_jobs.
  dedupeKey?: string;
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
  const graphSnapshots = await Promise.all(
    eligibleFlows.map((flow) => loadGraphSnapshot(db, flow.id)),
  );
  const jobs = eligibleFlows.map((flow, index) => ({
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
    graph_snapshot: graphSnapshots[index],
    dedupe_key: input.dedupeKey ?? null,
  }));

  // upsert + ignoreDuplicates em vez de insert: se um dedupe_key já foi usado
  // pra esse flow (retry do EventBus, reentrega de webhook), o Postgres
  // ignora a linha em conflito em vez de criar um job duplicado. Jobs sem
  // dedupe_key (ex.: "Testar fluxo") nunca colidem, porque o índice único é
  // parcial (WHERE dedupe_key IS NOT NULL).
  const { data: insertedJobs, error: insertError } = await db
    .from("conversation_flow_jobs")
    .upsert(jobs, { onConflict: "flow_id,dedupe_key", ignoreDuplicates: true })
    .select("id");

  if (insertError) {
    return { queued: 0, error: insertError.message };
  }

  return { queued: insertedJobs?.length ?? 0, error: null };
}

// Cancela jobs pendentes de um lead cujo fluxo não tenha optado por
// continuar mesmo com agendamento (trigger_config.skip_when_scheduled ===
// false é um opt-out explícito do autor do fluxo). Chamado no momento em que
// um agendamento é vinculado a um lead (ver BookingCrmSyncService) — evita
// que uma mensagem de recuperação/abandono seja enviada depois que o lead já
// marcou reunião. Complementar à reavaliação defensiva em flow-executor.ts
// (esta é a camada proativa; aquela é a rede de segurança).
export async function cancelConflictingConversationFlowJobs(
  db: Db,
  input: { leadId: string; reason: string },
): Promise<{ cancelled: number }> {
  const { data: jobs } = await db
    .from("conversation_flow_jobs")
    .select("id,flow_id,user_id")
    .eq("lead_id", input.leadId)
    .eq("status", "pending");

  const pendingJobs = (jobs ?? []) as { id: string; flow_id: string; user_id: string }[];
  if (pendingJobs.length === 0) return { cancelled: 0 };

  const flowIds = Array.from(new Set(pendingJobs.map((job) => job.flow_id)));
  const { data: flows } = await db
    .from("conversation_flows")
    .select("id,trigger_config")
    .in("id", flowIds);

  const optedOutFlowIds = new Set(
    ((flows ?? []) as { id: string; trigger_config: Record<string, unknown> | null }[])
      .filter((flow) => flow.trigger_config?.skip_when_scheduled === false)
      .map((flow) => flow.id),
  );

  const jobsToCancel = pendingJobs.filter((job) => !optedOutFlowIds.has(job.flow_id));
  if (jobsToCancel.length === 0) return { cancelled: 0 };

  const now = new Date().toISOString();
  await db
    .from("conversation_flow_jobs")
    .update({ status: "cancelled", cancelled_reason: input.reason, executed_at: now })
    .in("id", jobsToCancel.map((job) => job.id));

  await db.from("conversation_flow_logs").insert(
    jobsToCancel.map((job) => ({
      user_id: job.user_id,
      flow_id: job.flow_id,
      job_id: job.id,
      level: "info",
      message: input.reason,
    })),
  );

  return { cancelled: jobsToCancel.length };
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
