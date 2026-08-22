import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken } from "@/lib/crypto";
import { replyToInstagramComment, sendInstagramMessage } from "@/lib/instagram-api";
import { LeadService } from "@/lib/crm/lead-service";
import { matchesInstagramKeywords } from "./matching";
import { parseInstagramWebhook } from "./webhook";
import type { InstagramAutomationMatch, InstagramAutomationStep, InstagramAutomationTrigger, NormalizedInstagramEvent } from "./types";

type Db = SupabaseClient;
type AutomationRow = {
  id: string; organization_id: string; connection_id: string; trigger_type: InstagramAutomationTrigger;
  match_type: InstagramAutomationMatch; keywords: string[]; public_reply_text: string | null;
  steps: InstagramAutomationStep[]; crm_enabled: boolean; crm_pipeline_id: string | null; crm_stage_id: string | null;
};

function addMinutes(base: string, minutes: number) {
  return new Date(new Date(base).getTime() + minutes * 60_000).toISOString();
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
  const { data, error } = await db.from("marketing_instagram_contacts").upsert({
    organization_id: connection.organization_id,
    connection_id: connection.id,
    instagram_scoped_id: event.senderScopedId,
    username: event.senderUsername,
    last_inbound_at: event.occurredAt,
    updated_at: new Date().toISOString(),
  }, { onConflict: "connection_id,instagram_scoped_id" }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

async function scheduleRun(db: Db, automation: AutomationRow, eventId: string, event: NormalizedInstagramEvent, contactId: string | null) {
  const { data: insertedRun, error } = await db.from("marketing_instagram_automation_runs").upsert({
    organization_id: automation.organization_id,
    automation_id: automation.id,
    event_id: eventId,
    contact_id: contactId,
  }, { onConflict: "automation_id,event_id", ignoreDuplicates: true }).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  let run = insertedRun;
  if (!run) {
    const { data: existingRun, error: runError } = await db.from("marketing_instagram_automation_runs")
      .select("id").eq("automation_id", automation.id).eq("event_id", eventId).single();
    if (runError || !existingRun) throw new Error(runError?.message ?? "Execução idempotente não encontrada");
    const { count, error: countError } = await db.from("marketing_instagram_automation_jobs")
      .select("id", { count: "exact", head: true }).eq("run_id", existingRun.id);
    if (countError) throw new Error(countError.message);
    if ((count ?? 0) > 0) return true;
    run = existingRun;
  }

  const jobs: Record<string, unknown>[] = [];
  let stepIndex = 0;
  let cumulativeDelay = 0;
  const baseTime = new Date().toISOString();
  if (event.eventType === "comment" && automation.public_reply_text?.trim()) {
    jobs.push({
      organization_id: automation.organization_id, run_id: run.id, step_index: stepIndex++,
      action_type: "public_reply", payload: { text: automation.public_reply_text.trim() }, scheduled_for: baseTime,
    });
  }
  const steps = automation.steps ?? [];
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    cumulativeDelay += Math.max(0, Number(step.delayMinutes) || 0);
    jobs.push({
      organization_id: automation.organization_id, run_id: run.id, step_index: stepIndex++,
      action_type: event.eventType === "comment" && index === 0 ? "private_reply" : "dm",
      payload: { text: step.text.trim() }, scheduled_for: addMinutes(baseTime, cumulativeDelay),
    });
  }
  if (automation.crm_enabled && automation.crm_stage_id) {
    jobs.push({
      organization_id: automation.organization_id, run_id: run.id, step_index: stepIndex++,
      action_type: "crm", payload: { stageId: automation.crm_stage_id }, scheduled_for: addMinutes(baseTime, cumulativeDelay),
    });
  }
  if (jobs.length) {
    const queued = await db.from("marketing_instagram_automation_jobs").insert(jobs);
    if (queued.error) throw new Error(queued.error.message);
  }
  return true;
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
    const contactId = await upsertContact(db, connection, event);
    const { data: automations, error } = await db.from("marketing_instagram_automations")
      .select("id,organization_id,connection_id,trigger_type,match_type,keywords,public_reply_text,steps,crm_enabled,crm_pipeline_id,crm_stage_id")
      .eq("connection_id", connection.id)
      .eq("trigger_type", event.eventType)
      .eq("status", "active");
    if (error) throw new Error(error.message);
    let eventMatched = false;
    for (const automation of (automations ?? []) as AutomationRow[]) {
      if (!matchesInstagramKeywords(event.text, automation.keywords ?? [], automation.match_type)) continue;
      if (await scheduleRun(db, automation, persisted.id, event, contactId)) {
        matched += 1;
        eventMatched = true;
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
  id: string; run_id: string; step_index: number; action_type: "public_reply" | "private_reply" | "dm" | "crm";
  payload: Record<string, unknown>; attempts: number; max_attempts: number;
};

async function refreshRunStatus(db: Db, runId: string) {
  const { data: jobs } = await db.from("marketing_instagram_automation_jobs").select("status").eq("run_id", runId);
  const statuses = (jobs ?? []).map(row => row.status as string);
  if (statuses.some(status => ["pending", "processing", "retry"].includes(status))) return;
  const completed = statuses.filter(status => status === "completed").length;
  const failed = statuses.filter(status => status === "dead_letter").length;
  const status = failed === 0 ? "completed" : completed > 0 ? "partial" : "failed";
  await db.from("marketing_instagram_automation_runs").update({ status, completed_at: new Date().toISOString() }).eq("id", runId);
}

async function createCrmLead(db: Db, run: Record<string, any>, event: Record<string, any>, contact: Record<string, any> | null, stageId: string) {
  if (contact?.crm_lead_id) return contact.crm_lead_id as string;
  const username = event.sender_username as string | null;
  const scopedId = event.sender_scoped_id as string | null;
  const service = new LeadService(db);
  const result = await service.createLead({
    user_id: run.organization_id as string,
    stageId,
    name: username ? `@${username}` : "Lead do Instagram",
    contact: username ? `instagram:@${username}` : `instagram:${scopedId ?? "desconhecido"}`,
    email: null,
    source: "instagram_automation",
    form_name: "Automação do Instagram",
    notes: event.text ? `Interação recebida: ${String(event.text).slice(0, 1000)}` : null,
    integration_notes: `Instagram scoped ID: ${scopedId ?? "não informado"}`,
  });
  if (!result.ok || !result.leadId) throw new Error(result.error ?? "Não foi possível criar o lead no CRM");
  if (contact?.id) await db.from("marketing_instagram_contacts").update({ crm_lead_id: result.leadId }).eq("id", contact.id);
  await db.from("marketing_instagram_automation_runs").update({ crm_lead_id: result.leadId }).eq("id", run.id);
  return result.leadId;
}

export async function processInstagramAutomationJob(db: Db, jobId: string) {
  const now = new Date().toISOString();
  const { data: current } = await db.from("marketing_instagram_automation_jobs").select("*").eq("id", jobId).maybeSingle();
  if (!current || !["pending", "retry"].includes(current.status) || current.scheduled_for > now) return "skipped" as const;
  const { data: previous } = await db.from("marketing_instagram_automation_jobs").select("status")
    .eq("run_id", current.run_id).lt("step_index", current.step_index)
    .in("status", ["pending", "processing", "retry"])
    .limit(1);
  if (previous?.length) return "skipped" as const;
  const { data: claimed } = await db.from("marketing_instagram_automation_jobs")
    .update({ status: "processing", locked_at: now, attempts: current.attempts + 1, updated_at: now })
    .eq("id", jobId).in("status", ["pending", "retry"]).lte("scheduled_for", now).select("*").maybeSingle();
  if (!claimed) return "skipped" as const;
  const job = claimed as JobRow;
  await db.from("marketing_instagram_automation_runs").update({ status: "running", started_at: now }).eq("id", job.run_id).eq("status", "queued");

  const { data: run } = await db.from("marketing_instagram_automation_runs").select("*").eq("id", job.run_id).single();
  const [{ data: automation }, { data: event }, { data: contact }] = await Promise.all([
    db.from("marketing_instagram_automations").select("*").eq("id", run.automation_id).single(),
    db.from("marketing_instagram_automation_events").select("*").eq("id", run.event_id).single(),
    run.contact_id ? db.from("marketing_instagram_contacts").select("*").eq("id", run.contact_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const { data: connection } = await db.from("marketing_instagram_connections")
    .select("instagram_user_id,encrypted_access_token,status")
    .eq("id", automation.connection_id).single();

  let externalMessageId: string | null = null;
  let error: unknown = null;
  try {
    if (!connection) throw Object.assign(new Error("Conexão do Instagram não encontrada"), { permanent: true });
    if (connection.status !== "connected") throw Object.assign(new Error("A conexão do Instagram não está ativa"), { permanent: true });
    const text = String(job.payload.text ?? "").trim();
    if (job.action_type === "crm") {
      await createCrmLead(db, run, event, contact, String(job.payload.stageId ?? automation.crm_stage_id));
    } else {
      const accessToken = decryptToken(connection.encrypted_access_token);
      if (job.action_type === "public_reply") {
        if (!event.comment_id) throw Object.assign(new Error("Comentário sem ID para resposta pública"), { permanent: true });
        externalMessageId = (await replyToInstagramComment(event.comment_id, text, accessToken)).id;
      } else if (job.action_type === "private_reply") {
        if (!event.comment_id) throw Object.assign(new Error("Comentário sem ID para resposta privada"), { permanent: true });
        externalMessageId = (await sendInstagramMessage(connection.instagram_user_id, { comment_id: event.comment_id }, text, accessToken)).message_id;
      } else {
        if (!event.sender_scoped_id) throw Object.assign(new Error("Mensagem sem destinatário do Instagram"), { permanent: true });
        externalMessageId = (await sendInstagramMessage(connection.instagram_user_id, { id: event.sender_scoped_id }, text, accessToken)).message_id;
      }
    }
  } catch (caught) {
    error = caught;
  }

  if (!error) {
    await db.from("marketing_instagram_automation_jobs").update({
      status: "completed", locked_at: null, external_message_id: externalMessageId,
      last_error: null, completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", job.id).eq("status", "processing");
    await refreshRunStatus(db, job.run_id);
    return "completed" as const;
  }

  const typed = error as Error & { status?: number; permanent?: boolean };
  const retryable = !typed.permanent && (typed.status === undefined || typed.status === 408 || typed.status === 429 || typed.status >= 500);
  if (retryable && job.attempts < job.max_attempts) {
    const delayMs = Math.min(15 * 60_000, 30_000 * 2 ** Math.max(0, job.attempts - 1));
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

export async function runDueInstagramAutomationJobs(db: Db, limit = 20) {
  const staleAt = new Date(Date.now() - 5 * 60_000).toISOString();
  await db.from("marketing_instagram_automation_jobs").update({
    status: "retry", locked_at: null, scheduled_for: new Date().toISOString(),
    last_error: "Lock expirado; ação reagendada", updated_at: new Date().toISOString(),
  }).eq("status", "processing").lt("locked_at", staleAt);
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
