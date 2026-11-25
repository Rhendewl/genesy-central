import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken } from "@/lib/crypto";
import { replyToInstagramComment, sendInstagramMessage, sendInstagramMessagePayload } from "@/lib/instagram-api";
import { LeadService } from "@/lib/crm/lead-service";
import { matchesInstagramKeywords } from "./matching";
import {
  INSTAGRAM_AUTOMATION_DAILY_LIMIT,
  INSTAGRAM_AUTOMATION_HOURLY_LIMIT,
  INSTAGRAM_CONTACT_DAILY_LIMIT,
  isInstagramActionWithinWindow,
  isInstagramOptOut,
} from "./policy";
import { parseInstagramWebhook } from "./webhook";
import {
  FLOW_MAX_STEPS_PER_RUN,
  FLOW_MAX_WAIT_MINUTES,
  FLOW_TRIGGER_ID,
  addTag,
  buildFlowPayload,
  contactWindow,
  evaluateCondition,
  findNode,
  instagramMessageBody,
  legacyStepsToFlow,
  messageDelivery,
  nextNodeId,
  nodeWaitsForContact,
  parseFlowPayload,
  sanitizeFlow,
  type AutomationFlow,
  type CrmActionConfig,
  type FlowNode,
} from "./flow";
import type { InstagramAutomationMatch, InstagramAutomationStep, InstagramAutomationTrigger, NormalizedInstagramEvent } from "./types";

type Db = SupabaseClient;
type AutomationRow = {
  id: string; organization_id: string; connection_id: string; trigger_type: InstagramAutomationTrigger;
  match_type: InstagramAutomationMatch; keywords: string[]; public_reply_text: string | null;
  steps: InstagramAutomationStep[]; flow: unknown; crm_enabled: boolean; crm_pipeline_id: string | null; crm_stage_id: string | null;
  crm_origin_id: string | null; crm_assigned_to: string | null; crm_deal_value: number;
};
type ContactRow = {
  id: string; tags: string[] | null; opted_out_at: string | null; last_message_at: string | null;
  ad_window_until: string | null; crm_lead_id: string | null;
};
type RunVariables = { privateReplyUsed?: boolean; lastReply?: string | null; fromAd?: boolean; endReason?: string };

const SEND_ACTIONS = new Set(["public_reply", "private_reply", "dm"]);
const AD_WINDOW_MS = FLOW_MAX_WAIT_MINUTES * 60_000;

function addMinutes(base: string, minutes: number) {
  return new Date(new Date(base).getTime() + minutes * 60_000).toISOString();
}

function automationFlow(automation: AutomationRow): AutomationFlow {
  if (automation.flow) {
    try { return sanitizeFlow(automation.flow); } catch { /* fall back to the linear steps below */ }
  }
  return legacyStepsToFlow({
    triggerType: automation.trigger_type, steps: automation.steps, crmEnabled: automation.crm_enabled,
    crmPipelineId: automation.crm_pipeline_id, crmStageId: automation.crm_stage_id, crmOriginId: automation.crm_origin_id,
    crmAssignedTo: automation.crm_assigned_to, crmDealValue: automation.crm_deal_value,
  });
}

async function persistEvent(db: Db, connection: { id: string; organization_id: string }, event: NormalizedInstagramEvent) {
  const row = {
    organization_id: connection.organization_id,
    connection_id: connection.id,
    external_event_id: event.externalEventId,
    event_type: event.eventType,
    sender_scoped_id: event.senderScopedId,
    sender_username: event.senderUsername,
    comment_id: event.commentId,
    media_id: event.mediaId,
    message_id: event.messageId,
    text: event.text,
    raw_payload: event.rawPayload,
    occurred_at: event.occurredAt,
  };
  const { data: inserted, error } = await db.from("marketing_instagram_automation_events")
    .upsert(row, { onConflict: "connection_id,external_event_id", ignoreDuplicates: true })
    .select("id,status")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (inserted) return { ...(inserted as { id: string; status: string }), duplicate: false };
  const { data: existing, error: existingError } = await db.from("marketing_instagram_automation_events")
    .select("id,status").eq("connection_id", connection.id).eq("external_event_id", event.externalEventId).single();
  if (existingError || !existing) throw new Error(existingError?.message ?? "Evento duplicado não encontrado");
  return { ...(existing as { id: string; status: string }), duplicate: true };
}

async function upsertContact(db: Db, connection: { id: string; organization_id: string }, event: NormalizedInstagramEvent) {
  if (!event.senderScopedId) return null;
  const optedOutNow = isInstagramOptOut(event.text);
  const row: Record<string, unknown> = {
    organization_id: connection.organization_id,
    connection_id: connection.id,
    instagram_scoped_id: event.senderScopedId,
    last_inbound_at: event.occurredAt,
    updated_at: new Date().toISOString(),
  };
  // Direct events carry no username: never overwrite the one learned from a comment.
  if (event.senderUsername) row.username = event.senderUsername;
  // A comment does not open the Direct messaging window; any Direct interaction does.
  if (event.eventType !== "comment") row.last_message_at = event.occurredAt;
  if (event.fromAd && event.eventType === "message") {
    row.ad_window_until = new Date(new Date(event.occurredAt).getTime() + AD_WINDOW_MS).toISOString();
  }
  if (optedOutNow) row.opted_out_at = new Date().toISOString();
  const { data, error } = await db.from("marketing_instagram_contacts")
    .upsert(row, { onConflict: "connection_id,instagram_scoped_id" })
    .select("id,tags,opted_out_at,last_message_at,ad_window_until,crm_lead_id").single();
  if (error) throw new Error(error.message);
  const contact = data as ContactRow;
  return { ...contact, optedOut: optedOutNow || Boolean(contact.opted_out_at) };
}

async function nextStepIndex(db: Db, runId: string) {
  const { data, error } = await db.from("marketing_instagram_automation_jobs")
    .select("step_index").eq("run_id", runId).order("step_index", { ascending: false }).limit(1);
  if (error) throw new Error(error.message);
  return data?.length ? Number(data[0].step_index) + 1 : 0;
}

async function enqueueFlowJob(
  db: Db,
  run: { id: string; organization_id: string },
  flow: AutomationFlow,
  nodeId: string,
  scheduledFor: string,
  actionType: "flow_node" | "flow_timeout" = "flow_node",
) {
  const stepIndex = await nextStepIndex(db, run.id);
  if (stepIndex >= FLOW_MAX_STEPS_PER_RUN) {
    await finishFlowRun(db, run.id, "Limite de etapas por execução atingido (possível laço no fluxo)");
    return null;
  }
  const { error } = await db.from("marketing_instagram_automation_jobs").insert({
    organization_id: run.organization_id, run_id: run.id, step_index: stepIndex,
    // nodeType lets the stale-lock recovery tell sends (never retried) from safe steps.
    action_type: actionType, payload: { nodeId, nodeType: findNode(flow, nodeId)?.type ?? null }, scheduled_for: scheduledFor,
  });
  if (error) throw new Error(error.message);
  return stepIndex;
}

async function scheduleRun(db: Db, automation: AutomationRow, eventId: string, event: NormalizedInstagramEvent, contactId: string | null) {
  const flow = automationFlow(automation);
  const { data: insertedRun, error } = await db.from("marketing_instagram_automation_runs").upsert({
    organization_id: automation.organization_id,
    automation_id: automation.id,
    event_id: eventId,
    contact_id: contactId,
    flow_snapshot: flow,
    current_node_id: FLOW_TRIGGER_ID,
    variables: { fromAd: Boolean(event.fromAd), lastReply: event.eventType === "comment" ? null : event.text },
  }, { onConflict: "automation_id,event_id", ignoreDuplicates: true }).select("id,organization_id").maybeSingle();
  if (error) throw new Error(error.message);
  let run = insertedRun as { id: string; organization_id: string } | null;
  if (!run) {
    const { data: existingRun, error: runError } = await db.from("marketing_instagram_automation_runs")
      .select("id,organization_id").eq("automation_id", automation.id).eq("event_id", eventId).single();
    if (runError || !existingRun) throw new Error(runError?.message ?? "Execução idempotente não encontrada");
    const { count, error: countError } = await db.from("marketing_instagram_automation_jobs")
      .select("id", { count: "exact", head: true }).eq("run_id", existingRun.id);
    if (countError) throw new Error(countError.message);
    if ((count ?? 0) > 0) return true;
    run = existingRun as { id: string; organization_id: string };
  }
  await enqueueFlowJob(db, run, flow, FLOW_TRIGGER_ID, new Date().toISOString());
  return true;
}

/**
 * A Direct reply (or a tap on a reply button) continues the run that is
 * waiting for this contact instead of starting a new automation.
 */
async function resumeWaitingRun(db: Db, contactId: string, event: NormalizedInstagramEvent): Promise<"resumed" | "stale" | null> {
  const payload = parseFlowPayload(event.text);
  let query = db.from("marketing_instagram_automation_runs")
    .select("id,organization_id,current_node_id,waiting_for,variables,flow_snapshot")
    .eq("contact_id", contactId).eq("status", "waiting");
  if (payload) query = query.eq("id", payload.runId).eq("current_node_id", payload.nodeId).eq("waiting_for", "button");
  else if (event.eventType === "message" || event.eventType === "story_reply") query = query.eq("waiting_for", "reply");
  else return null;
  const { data: rows, error } = await query.order("created_at", { ascending: false }).limit(1);
  if (error) throw new Error(error.message);
  const run = rows?.[0] as { id: string; organization_id: string; current_node_id: string; variables: RunVariables | null; flow_snapshot: AutomationFlow } | undefined;
  // A tap on a button of a run that already moved on must not start anything else.
  if (!run) return payload ? "stale" : null;
  const handle = payload ? `button:${payload.buttonId}` : "reply";
  const variables: RunVariables = { ...(run.variables ?? {}), lastReply: event.text };
  if (payload) {
    const node = findNode(run.flow_snapshot, run.current_node_id);
    const button = node?.type === "message" ? node.data.buttons.find(item => item.id === payload.buttonId) : null;
    variables.lastReply = button?.label ?? null;
  }
  const { data: claimed } = await db.from("marketing_instagram_automation_runs")
    .update({ status: "running", waiting_for: null, wait_until: null, variables })
    .eq("id", run.id).eq("status", "waiting").eq("current_node_id", run.current_node_id)
    .select("id").maybeSingle();
  if (!claimed) return "stale";
  await db.from("marketing_instagram_automation_jobs").update({
    status: "skipped", last_error: "Contato interagiu antes do tempo limite", updated_at: new Date().toISOString(),
  }).eq("run_id", run.id).eq("action_type", "flow_timeout").in("status", ["pending", "retry"]);
  const target = nextNodeId(run.flow_snapshot, run.current_node_id, handle);
  if (!target) await finishFlowRun(db, run.id);
  else await enqueueFlowJob(db, run, run.flow_snapshot, target, new Date().toISOString());
  return "resumed";
}

export async function ingestInstagramWebhook(db: Db, payload: unknown) {
  const parsed = parseInstagramWebhook(payload);
  let accepted = 0;
  let duplicates = 0;
  let matched = 0;
  for (const event of parsed) {
    const { data: connection } = await db.from("marketing_instagram_connections")
      .select("id,organization_id")
      .eq("instagram_user_id", event.accountId)
      .eq("status", "connected")
      .maybeSingle();
    if (!connection) continue;
    const persisted = await persistEvent(db, connection, event);
    if (persisted.duplicate) {
      duplicates += 1;
      // A redelivery also repairs a failure between event persistence and job
      // scheduling. Finalized events are safe to acknowledge immediately.
      if (persisted.status !== "received") continue;
    }
    accepted += 1;
    const contact = await upsertContact(db, connection, event);
    const contactId = contact?.id ?? null;
    if (contact?.optedOut) {
      const ignored = await db.from("marketing_instagram_automation_events").update({ status: "ignored" }).eq("id", persisted.id);
      if (ignored.error) throw new Error(ignored.error.message);
      continue;
    }
    let eventMatched = false;
    const resumed = contactId ? await resumeWaitingRun(db, contactId, event) : null;
    if (resumed === "resumed") { matched += 1; eventMatched = true; }
    if (!resumed) {
      const { data: automations, error } = await db.from("marketing_instagram_automations")
        .select("id,organization_id,connection_id,trigger_type,match_type,keywords,public_reply_text,steps,flow,crm_enabled,crm_pipeline_id,crm_stage_id,crm_origin_id,crm_assigned_to,crm_deal_value")
        .eq("connection_id", connection.id)
        .eq("trigger_type", event.eventType)
        .eq("status", "active")
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      for (const automation of (automations ?? []) as AutomationRow[]) {
        if (event.eventType === "comment" && automation.match_type === "any") continue;
        if (!matchesInstagramKeywords(event.text, automation.keywords ?? [], automation.match_type)) continue;
        if (await scheduleRun(db, automation, persisted.id, event, contactId)) {
          matched += 1;
          eventMatched = true;
          // A single inbound interaction must never fan out into competing
          // automations. For comments this also enforces Meta's one-private-reply
          // limit across the whole connected account, not only inside one flow.
          break;
        }
      }
    }
    const finalized = await db.from("marketing_instagram_automation_events")
      .update({ status: eventMatched ? "matched" : "ignored" })
      .eq("id", persisted.id);
    if (finalized.error) throw new Error(finalized.error.message);
  }
  return { received: parsed.length, accepted, duplicates, matched };
}

type JobRow = {
  id: string; run_id: string; step_index: number;
  action_type: "public_reply" | "private_reply" | "dm" | "crm" | "flow_node" | "flow_timeout";
  payload: Record<string, unknown>; attempts: number; max_attempts: number;
};

async function skipJob(db: Db, job: JobRow, reason: string) {
  await db.from("marketing_instagram_automation_jobs").update({
    status: "skipped", locked_at: null, last_error: reason.slice(0, 1000), updated_at: new Date().toISOString(),
  }).eq("id", job.id).eq("status", "processing");
  await refreshRunStatus(db, job.run_id);
  return "skipped" as const;
}

async function outboundLimitReason(db: Db, automationId: string, contactId: string | null) {
  const now = Date.now();
  const sinceDay = new Date(now - 24 * 60 * 60_000).toISOString();
  const sinceHour = new Date(now - 60 * 60_000).toISOString();
  const { data: recentRuns } = await db.from("marketing_instagram_automation_runs")
    .select("id,created_at,contact_id").eq("automation_id", automationId).gte("created_at", sinceDay);
  const runRows = recentRuns ?? [];
  const runIds = runRows.map(row => row.id as string);
  if (!runIds.length) return null;
  const { data: sent } = await db.from("marketing_instagram_automation_jobs")
    .select("run_id,completed_at,action_type,payload").in("run_id", runIds).eq("status", "completed")
    .in("action_type", ["public_reply", "private_reply", "dm", "flow_node"]);
  const sentRows = (sent ?? []).filter(row => SEND_ACTIONS.has(row.action_type) || (row.payload as Record<string, unknown> | null)?.sent === true);
  const hourly = sentRows.filter(row => row.completed_at && row.completed_at >= sinceHour).length;
  if (hourly >= INSTAGRAM_AUTOMATION_HOURLY_LIMIT) return "Limite preventivo de mensagens por hora atingido";
  if (sentRows.length >= INSTAGRAM_AUTOMATION_DAILY_LIMIT) return "Limite preventivo de mensagens por dia atingido";
  if (contactId) {
    const contactRunIds = new Set(runRows.filter(row => row.contact_id === contactId).map(row => row.id));
    const contactTotal = sentRows.filter(row => contactRunIds.has(row.run_id)).length;
    if (contactTotal >= INSTAGRAM_CONTACT_DAILY_LIMIT) return "Limite preventivo diário para este contato atingido";
  }
  return null;
}

async function refreshRunStatus(db: Db, runId: string) {
  const { data: jobs } = await db.from("marketing_instagram_automation_jobs").select("status,action_type").eq("run_id", runId);
  const rows = (jobs ?? []) as Array<{ status: string; action_type: string }>;
  if (rows.some(row => ["pending", "processing", "retry"].includes(row.status) && row.action_type !== "flow_timeout")) return;
  const statuses = rows.filter(row => row.action_type !== "flow_timeout").map(row => row.status);
  const completed = statuses.filter(status => status === "completed").length;
  const failed = statuses.filter(status => status === "dead_letter").length;
  const status = failed === 0 ? "completed" : completed > 0 ? "partial" : "failed";
  await db.from("marketing_instagram_automation_runs").update({
    status, completed_at: new Date().toISOString(), waiting_for: null, wait_until: null,
  }).eq("id", runId).in("status", ["queued", "running"]);
}

async function finishFlowRun(db: Db, runId: string, reason?: string) {
  if (reason) {
    const { data: run } = await db.from("marketing_instagram_automation_runs").select("variables").eq("id", runId).maybeSingle();
    await db.from("marketing_instagram_automation_runs")
      .update({ variables: { ...((run?.variables as RunVariables | null) ?? {}), endReason: reason } }).eq("id", runId);
  }
  await refreshRunStatus(db, runId);
}

type CrmConfig = { stageId: string; originId: string | null; assignedTo: string | null; dealValue: number };

async function createCrmLead(db: Db, run: Record<string, any>, event: Record<string, any>, contact: Record<string, any> | null, config: CrmConfig) {
  if (contact?.crm_lead_id) return contact.crm_lead_id as string;
  const username = event.sender_username as string | null;
  const scopedId = event.sender_scoped_id as string | null;
  const { data: origin } = config.originId ? await db.from("crm_lead_origins")
    .select("id,slug").eq("id", config.originId).eq("user_id", run.organization_id).maybeSingle() : { data: null };
  const service = new LeadService(db);
  const result = await service.createLead({
    user_id: run.organization_id as string,
    stageId: config.stageId,
    name: username ? `@${username}` : "Lead do Instagram",
    contact: username ? `instagram:@${username}` : `instagram:${scopedId ?? "desconhecido"}`,
    email: null,
    source: origin?.slug ?? "instagram_automation",
    origin_id: origin?.id ?? null,
    assigned_to: config.assignedTo,
    deal_value: Math.max(0, Number(config.dealValue) || 0),
    form_name: "Automação do Instagram",
    notes: event.text ? `Interação recebida: ${String(event.text).slice(0, 1000)}` : null,
    integration_notes: `Instagram scoped ID: ${scopedId ?? "não informado"}`,
  });
  if (!result.ok || !result.leadId) throw new Error(result.error ?? "Não foi possível criar o lead no CRM");
  if (contact?.id) await db.from("marketing_instagram_contacts").update({ crm_lead_id: result.leadId }).eq("id", contact.id);
  await db.from("marketing_instagram_automation_runs").update({ crm_lead_id: result.leadId }).eq("id", run.id);
  return result.leadId;
}

async function claimJob(db: Db, jobId: string) {
  const now = new Date().toISOString();
  const { data: current } = await db.from("marketing_instagram_automation_jobs").select("*").eq("id", jobId).maybeSingle();
  if (!current || !["pending", "retry"].includes(current.status) || current.scheduled_for > now) return null;
  const { data: previous } = await db.from("marketing_instagram_automation_jobs").select("status")
    .eq("run_id", current.run_id).lt("step_index", current.step_index)
    .in("status", ["pending", "processing", "retry"])
    .limit(1);
  if (previous?.length) return null;
  const { data: blockedPrevious } = await db.from("marketing_instagram_automation_jobs").select("status,action_type")
    .eq("run_id", current.run_id).lt("step_index", current.step_index)
    .in("status", ["dead_letter", "skipped"])
    .limit(5);
  const { data: claimed } = await db.from("marketing_instagram_automation_jobs")
    .update({ status: "processing", locked_at: now, attempts: current.attempts + 1, updated_at: now })
    .eq("id", jobId).in("status", ["pending", "retry"]).lte("scheduled_for", now).select("*").maybeSingle();
  if (!claimed) return null;
  // Cancelled timeouts are expected in flows; any other skipped/failed step breaks the chain.
  const blocked = (blockedPrevious ?? []).some(row => row.action_type !== "flow_timeout");
  return { job: claimed as JobRow, blocked, now };
}

async function failOrRetry(db: Db, job: JobRow, automationId: string, error: unknown) {
  const typed = error as Error & { status?: number; code?: number; permanent?: boolean };
  const policyOrAuthError = [10, 190, 200, 368].includes(Number(typed.code));
  const circuitOpen = policyOrAuthError || (typed.status === 429 && job.attempts >= 2);
  if (circuitOpen) {
    await db.from("marketing_instagram_automations").update({ status: "paused", updated_at: new Date().toISOString() }).eq("id", automationId);
  }
  const retryable = !typed.permanent && !circuitOpen
    && (typed.status === undefined || typed.status === 408 || typed.status === 429 || typed.status >= 500);
  if (retryable && job.attempts < job.max_attempts) {
    const baseDelay = typed.status === 429 ? 15 * 60_000 : Math.min(15 * 60_000, 30_000 * 2 ** Math.max(0, job.attempts - 1));
    const delayMs = baseDelay + Math.floor(Math.random() * Math.min(30_000, baseDelay * 0.2));
    await db.from("marketing_instagram_automation_jobs").update({
      status: "retry", locked_at: null, scheduled_for: new Date(Date.now() + delayMs).toISOString(),
      last_error: typed.message.slice(0, 1000), updated_at: new Date().toISOString(),
    }).eq("id", job.id).eq("status", "processing");
    return "retry" as const;
  }
  await db.from("marketing_instagram_automation_jobs").update({
    status: "dead_letter", locked_at: null, last_error: typed.message.slice(0, 1000), updated_at: new Date().toISOString(),
  }).eq("id", job.id).eq("status", "processing");
  await refreshRunStatus(db, job.run_id);
  return "dead_letter" as const;
}

async function loadJobContext(db: Db, runId: string) {
  const { data: run } = await db.from("marketing_instagram_automation_runs").select("*").eq("id", runId).single();
  const [{ data: automation }, { data: event }, { data: contact }] = await Promise.all([
    db.from("marketing_instagram_automations").select("*").eq("id", run.automation_id).single(),
    db.from("marketing_instagram_automation_events").select("*").eq("id", run.event_id).single(),
    run.contact_id ? db.from("marketing_instagram_contacts").select("*").eq("id", run.contact_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const { data: connection } = await db.from("marketing_instagram_connections")
    .select("instagram_user_id,encrypted_access_token,status")
    .eq("id", automation.connection_id).single();
  return { run, automation, event, contact, connection };
}

async function processLegacyJob(db: Db, job: JobRow, blocked: boolean, now: string) {
  if (blocked) return await skipJob(db, job, "Etapa anterior não foi entregue; sequência interrompida");
  await db.from("marketing_instagram_automation_runs").update({ status: "running", started_at: now }).eq("id", job.run_id).eq("status", "queued");
  const { run, automation, event, contact, connection } = await loadJobContext(db, job.run_id);

  let externalMessageId: string | null = null;
  try {
    if (!connection) throw Object.assign(new Error("Conexão do Instagram não encontrada"), { permanent: true });
    if (connection.status !== "connected") throw Object.assign(new Error("A conexão do Instagram não está ativa"), { permanent: true });
    if (automation.status !== "active") return await skipJob(db, job, "Automação pausada ou desativada");
    if (contact?.opted_out_at) return await skipJob(db, job, "Contato cancelou o recebimento de mensagens automáticas");
    const text = String(job.payload.text ?? "").trim();
    if (job.action_type === "crm") {
      await createCrmLead(db, run, event, contact, {
        stageId: String(job.payload.stageId ?? automation.crm_stage_id),
        originId: job.payload.originId ? String(job.payload.originId) : automation.crm_origin_id,
        assignedTo: job.payload.assignedTo ? String(job.payload.assignedTo) : automation.crm_assigned_to,
        dealValue: Number(job.payload.dealValue ?? automation.crm_deal_value ?? 0),
      });
    } else {
      if (!isInstagramActionWithinWindow(event.event_type, event.occurred_at)) {
        return await skipJob(db, job, "Janela de mensagens permitida pela Meta encerrada");
      }
      const limitReason = await outboundLimitReason(db, automation.id, run.contact_id ?? null);
      if (limitReason) return await skipJob(db, job, limitReason);
      const accessToken = decryptToken(connection.encrypted_access_token);
      if (job.action_type === "public_reply") {
        if (!event.comment_id) throw Object.assign(new Error("Comentário sem ID para resposta pública"), { permanent: true });
        externalMessageId = (await replyToInstagramComment(event.comment_id, text, accessToken)).id;
      } else if (job.action_type === "private_reply") {
        if (!event.comment_id) throw Object.assign(new Error("Comentário sem ID para resposta privada"), { permanent: true });
        externalMessageId = (await sendInstagramMessage(connection.instagram_user_id, { comment_id: event.comment_id }, { text, button: job.payload.button as { label: string; url: string } | undefined }, accessToken)).message_id;
      } else {
        if (!event.sender_scoped_id) throw Object.assign(new Error("Mensagem sem destinatário do Instagram"), { permanent: true });
        externalMessageId = (await sendInstagramMessage(connection.instagram_user_id, { id: event.sender_scoped_id }, { text, button: job.payload.button as { label: string; url: string } | undefined }, accessToken)).message_id;
      }
    }
  } catch (caught) {
    return await failOrRetry(db, job, automation.id, caught);
  }
  await db.from("marketing_instagram_automation_jobs").update({
    status: "completed", locked_at: null, external_message_id: externalMessageId,
    last_error: null, completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq("id", job.id).eq("status", "processing");
  await refreshRunStatus(db, job.run_id);
  return "completed" as const;
}

type FlowStep =
  | { kind: "advance"; handle: string; delayMinutes?: number }
  | { kind: "wait"; waitingFor: "reply" | "button"; timeoutMinutes: number | null }
  | { kind: "skip"; reason: string };

async function processFlowJob(db: Db, job: JobRow, blocked: boolean, now: string) {
  if (blocked) return await skipJob(db, job, "Etapa anterior não foi concluída; fluxo interrompido");
  const { run, automation, event, contact, connection } = await loadJobContext(db, job.run_id);
  const flow = run.flow_snapshot as AutomationFlow;
  const nodeId = String(job.payload.nodeId ?? "");
  const node = findNode(flow, nodeId);
  const variables: RunVariables = { ...((run.variables as RunVariables | null) ?? {}) };

  const complete = async (extra: Record<string, unknown> = {}, externalMessageId: string | null = null) => {
    await db.from("marketing_instagram_automation_jobs").update({
      status: "completed", locked_at: null, external_message_id: externalMessageId, last_error: null,
      payload: { ...job.payload, ...extra }, completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", job.id).eq("status", "processing");
  };

  if (job.action_type === "flow_timeout") {
    // The contact may have answered in the meantime; then this timeout is moot.
    const { data: claimedRun } = await db.from("marketing_instagram_automation_runs")
      .update({ status: "running", waiting_for: null, wait_until: null })
      .eq("id", run.id).eq("status", "waiting").eq("current_node_id", nodeId).select("id").maybeSingle();
    if (!claimedRun) return await skipJob(db, job, "Contato já interagiu");
    await complete();
    const target = nextNodeId(flow, nodeId, "timeout");
    if (!target) await finishFlowRun(db, run.id);
    else await enqueueFlowJob(db, run, flow, target, new Date().toISOString());
    return "completed" as const;
  }

  if (!node) {
    await skipJob(db, job, "Bloco não encontrado no fluxo");
    return "skipped" as const;
  }
  await db.from("marketing_instagram_automation_runs").update({
    status: "running", current_node_id: node.id, ...(run.started_at ? {} : { started_at: now }),
  }).eq("id", run.id);

  let step: FlowStep;
  let externalMessageId: string | null = null;
  let counted = false;
  let sent = false;
  try {
    if (!connection) throw Object.assign(new Error("Conexão do Instagram não encontrada"), { permanent: true });
    if (connection.status !== "connected") throw Object.assign(new Error("A conexão do Instagram não está ativa"), { permanent: true });
    if (automation.status !== "active") return await skipJob(db, job, "Automação pausada ou desativada");
    if (contact?.opted_out_at) return await skipJob(db, job, "Contato cancelou o recebimento de mensagens automáticas");
    step = await executeNode(node);
  } catch (caught) {
    return await failOrRetry(db, job, automation.id, caught);
  }

  if (step.kind === "skip") return await skipJob(db, job, step.reason);
  if (step.kind === "wait") {
    // The timeout is queued before the run is marked as waiting, so a reply that
    // arrives right after the send always finds (and cancels) it. Without a
    // timeout branch the run still closes when Meta's longest window ends.
    const waitUntil = addMinutes(new Date().toISOString(), step.timeoutMinutes ?? FLOW_MAX_WAIT_MINUTES);
    await enqueueFlowJob(db, run, flow, node.id, waitUntil, "flow_timeout");
    await db.from("marketing_instagram_automation_runs").update({
      status: "waiting", waiting_for: step.waitingFor, wait_until: waitUntil, variables,
    }).eq("id", run.id);
    await complete({ ...(counted ? { counted: true } : {}), ...(sent ? { sent: true } : {}) }, externalMessageId);
    return "completed" as const;
  }
  await complete({ ...(counted ? { counted: true } : {}), ...(sent ? { sent: true } : {}) }, externalMessageId);
  await db.from("marketing_instagram_automation_runs").update({ variables }).eq("id", run.id);
  const target = nextNodeId(flow, node.id, step.handle);
  if (!target) await finishFlowRun(db, run.id);
  else await enqueueFlowJob(db, run, flow, target, addMinutes(new Date().toISOString(), step.delayMinutes ?? 0));
  return "completed" as const;

  async function executeNode(current: FlowNode): Promise<FlowStep> {
    switch (current.type) {
      case "trigger": {
        const text = String(automation.public_reply_text ?? "").trim();
        if (event.event_type === "comment" && text) {
          if (!event.comment_id) throw Object.assign(new Error("Comentário sem ID para resposta pública"), { permanent: true });
          const limitReason = await outboundLimitReason(db, automation.id, run.contact_id ?? null);
          if (limitReason) return { kind: "skip", reason: limitReason };
          externalMessageId = (await replyToInstagramComment(event.comment_id, text, decryptToken(connection.encrypted_access_token))).id;
          counted = true; sent = true;
        }
        return { kind: "advance", handle: "next" };
      }
      case "message": {
        const delivery = messageDelivery({
          isCommentRun: event.event_type === "comment",
          privateReplyUsed: Boolean(variables.privateReplyUsed),
          commentAt: event.occurred_at,
          window: contactWindow({ lastMessageAt: contact?.last_message_at ?? null, adWindowUntil: contact?.ad_window_until ?? null }),
        });
        if (!delivery.channel) return { kind: "skip", reason: delivery.reason };
        const limitReason = await outboundLimitReason(db, automation.id, run.contact_id ?? null);
        if (limitReason) return { kind: "skip", reason: limitReason };
        if (delivery.channel === "private_reply" && !event.comment_id) throw Object.assign(new Error("Comentário sem ID para resposta privada"), { permanent: true });
        if (delivery.channel === "dm" && !event.sender_scoped_id) throw Object.assign(new Error("Mensagem sem destinatário do Instagram"), { permanent: true });
        const recipient = delivery.channel === "private_reply" ? { comment_id: event.comment_id as string } : { id: event.sender_scoped_id as string };
        const body = instagramMessageBody(current.data, buttonId => buildFlowPayload(run.id, current.id, buttonId));
        externalMessageId = (await sendInstagramMessagePayload(connection.instagram_user_id, recipient, body, decryptToken(connection.encrypted_access_token))).message_id;
        counted = true; sent = true;
        if (delivery.channel === "private_reply") variables.privateReplyUsed = true;
        if (nodeWaitsForContact(current)) return { kind: "wait", waitingFor: "button", timeoutMinutes: current.data.timeoutMinutes ?? null };
        return { kind: "advance", handle: "next" };
      }
      case "delay":
        return { kind: "advance", handle: "next", delayMinutes: current.data.minutes };
      case "wait_reply":
        return { kind: "wait", waitingFor: "reply", timeoutMinutes: current.data.timeoutMinutes };
      case "condition": {
        const window = contactWindow({ lastMessageAt: contact?.last_message_at ?? null, adWindowUntil: contact?.ad_window_until ?? null });
        const result = evaluateCondition(current.data, {
          lastReply: variables.lastReply ?? null,
          tags: (contact?.tags as string[] | null) ?? [],
          fromAd: Boolean(variables.fromAd) || (window.open && window.source === "ad"),
        });
        return { kind: "advance", handle: result ? "yes" : "no" };
      }
      case "action": {
        if (current.data.kind === "add_tag") {
          if (contact?.id && current.data.tag) {
            const tags = addTag(contact.tags as string[] | null, current.data.tag);
            const { error } = await db.from("marketing_instagram_contacts").update({ tags, updated_at: new Date().toISOString() }).eq("id", contact.id);
            if (error) throw new Error(error.message);
            contact.tags = tags;
          }
          return { kind: "advance", handle: "next" };
        }
        const crm = current.data.crm as CrmActionConfig | undefined;
        if (!crm?.stageId) throw Object.assign(new Error("Etapa do CRM não configurada"), { permanent: true });
        await createCrmLead(db, run, event, contact, {
          stageId: crm.stageId, originId: crm.originId, assignedTo: crm.assignedTo, dealValue: crm.dealValue,
        });
        counted = true;
        return { kind: "advance", handle: "next" };
      }
    }
  }
}

export async function processInstagramAutomationJob(db: Db, jobId: string) {
  const claim = await claimJob(db, jobId);
  if (!claim) return "skipped" as const;
  const { job, blocked, now } = claim;
  if (job.action_type === "flow_node" || job.action_type === "flow_timeout") return processFlowJob(db, job, blocked, now);
  return processLegacyJob(db, job, blocked, now);
}

export async function runDueInstagramAutomationJobs(db: Db, limit = 20) {
  const staleAt = new Date(Date.now() - 5 * 60_000).toISOString();
  // Sends with an uncertain outcome are never retried: delivery is at most once.
  const uncertain = { status: "dead_letter", locked_at: null, last_error: "Resultado do envio incerto; não reenviado para evitar mensagem duplicada", updated_at: new Date().toISOString() };
  const requeue = { status: "retry", locked_at: null, scheduled_for: new Date().toISOString(), last_error: "Lock expirado; ação reagendada", updated_at: new Date().toISOString() };
  await db.from("marketing_instagram_automation_jobs").update(uncertain)
    .eq("status", "processing").in("action_type", ["public_reply", "private_reply", "dm"]).lt("locked_at", staleAt);
  await db.from("marketing_instagram_automation_jobs").update(uncertain)
    .eq("status", "processing").eq("action_type", "flow_node").in("payload->>nodeType", ["trigger", "message"]).lt("locked_at", staleAt);
  await db.from("marketing_instagram_automation_jobs").update(requeue)
    .eq("status", "processing").in("action_type", ["crm", "flow_timeout"]).lt("locked_at", staleAt);
  await db.from("marketing_instagram_automation_jobs").update(requeue)
    .eq("status", "processing").eq("action_type", "flow_node").in("payload->>nodeType", ["delay", "wait_reply", "condition", "action"]).lt("locked_at", staleAt);
  const { data: due } = await db.from("marketing_instagram_automation_jobs").select("id")
    .in("status", ["pending", "retry"]).lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for").limit(Math.min(100, Math.max(1, limit)));
  const outcomes: string[] = [];
  for (const row of due ?? []) outcomes.push(await processInstagramAutomationJob(db, row.id as string));
  return {
    processed: outcomes.filter(value => value !== "skipped").length,
    completed: outcomes.filter(value => value === "completed").length,
    retried: outcomes.filter(value => value === "retry").length,
    deadLettered: outcomes.filter(value => value === "dead_letter").length,
  };
}
