import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FLOW_TRIGGER_ID,
  describeNode,
  legacyStepsToFlow,
  nodeTitle,
  parseFlowPayload,
  sanitizeFlow,
  type AutomationFlow,
} from "./flow";

// Insights for one automation: who entered, how far they got, what they
// tapped and which data was collected. Aggregation is pure so it can be tested
// without a database; loadAutomationInsights only gathers the rows.

const TIME_ZONE = "America/Fortaleza";
const SEND_ACTIONS = new Set(["public_reply", "private_reply", "dm"]);
const IN_PROGRESS = new Set(["queued", "running", "waiting"]);
/** Skips that are part of normal flow life, not interruptions. */
const BENIGN_SKIPS = ["Contato já interagiu", "Contato interagiu antes do tempo limite"];

export interface InsightRun {
  id: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  contact_id: string | null;
  crm_lead_id: string | null;
  variables: Record<string, unknown> | null;
}
export interface InsightJob {
  run_id: string;
  action_type: string;
  status: string;
  payload: Record<string, unknown> | null;
  last_error: string | null;
}
export interface InsightTap { runId: string; nodeId: string; buttonId: string }
export interface InsightContact { id: string; username: string | null; full_name: string | null; fields: Record<string, string> | null }

export interface AutomationInsights {
  period: { days: number; from: string; to: string };
  totals: {
    entered: number;
    completed: number;
    inProgress: number;
    failed: number;
    completionRate: number;
    interacted: number;
    interactionRate: number;
    messagesSent: number;
    leads: number;
    withData: number;
    avgCompletionSeconds: number | null;
  };
  previous: { entered: number; completed: number };
  daily: Array<{ date: string; entered: number; completed: number }>;
  hours: number[];
  funnel: Array<{ nodeId: string; type: string; title: string; summary: string; reached: number }>;
  buttons: Array<{ nodeId: string; message: string; buttonId: string; label: string; taps: number }>;
  fields: Array<{ key: string; label: string; count: number }>;
  interruptions: Array<{ reason: string; count: number }>;
  recent: Array<{ runId: string; name: string; username: string | null; whatsapp: string | null; email: string | null; status: string; enteredAt: string; lead: boolean }>;
}

function zonedParts(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) % 24 };
}

const FIELD_LABELS: Record<string, string> = { nome: "Nome", whatsapp: "WhatsApp", email: "E-mail" };
export function insightFieldLabel(key: string) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  const words = key.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Blocks in the order a person meets them (breadth-first from the trigger). */
function flowOrder(flow: AutomationFlow) {
  const order: string[] = [];
  const queue = [FLOW_TRIGGER_ID];
  const seen = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    order.push(id);
    flow.edges.filter(edge => edge.source === id).forEach(edge => queue.push(edge.target));
  }
  return order;
}

export function buildInsights(input: {
  flow: AutomationFlow;
  runs: InsightRun[];
  jobs: InsightJob[];
  taps: InsightTap[];
  contacts: InsightContact[];
  previous: { entered: number; completed: number };
  days: number;
  now?: Date;
}): AutomationInsights {
  const now = input.now ?? new Date();
  const from = new Date(now.getTime() - input.days * 86_400_000);
  const runs = input.runs;
  const runIds = new Set(runs.map(run => run.id));
  const contacts = new Map(input.contacts.map(contact => [contact.id, contact]));

  const completedRuns = runs.filter(run => run.status === "completed");
  const durations = completedRuns
    .filter(run => run.completed_at)
    .map(run => (new Date(run.completed_at!).getTime() - new Date(run.created_at).getTime()) / 1000)
    .filter(value => Number.isFinite(value) && value >= 0);
  const tappedRuns = new Set(input.taps.filter(tap => runIds.has(tap.runId)).map(tap => tap.runId));
  const interacted = runs.filter(run => Number(run.variables?.interactions ?? 0) > 0 || tappedRuns.has(run.id)).length;
  const withData = runs.filter(run => {
    const fields = run.contact_id ? contacts.get(run.contact_id)?.fields : null;
    return Boolean(fields && Object.values(fields).some(Boolean));
  }).length;
  const entered = runs.length;

  // Daily series covers every day of the period, zero-filled.
  const dayKeys: string[] = [];
  for (let index = input.days - 1; index >= 0; index -= 1) {
    const key = zonedParts(new Date(now.getTime() - index * 86_400_000).toISOString()).date;
    if (!dayKeys.includes(key)) dayKeys.push(key);
  }
  const daily = new Map(dayKeys.map(key => [key, { date: key, entered: 0, completed: 0 }]));
  const hours = Array.from({ length: 24 }, () => 0);
  for (const run of runs) {
    const created = zonedParts(run.created_at);
    const day = daily.get(created.date);
    if (day) day.entered += 1;
    hours[created.hour] += 1;
    if (run.status === "completed" && run.completed_at) {
      const done = daily.get(zonedParts(run.completed_at).date);
      if (done) done.completed += 1;
    }
  }

  const reachedBy = new Map<string, Set<string>>();
  let messagesSent = 0;
  const interruptions = new Map<string, number>();
  for (const job of input.jobs) {
    if (!runIds.has(job.run_id)) continue;
    const payload = job.payload ?? {};
    if (job.status === "completed") {
      if (SEND_ACTIONS.has(job.action_type) || payload.sent === true) messagesSent += 1;
      if (job.action_type === "flow_node" && typeof payload.nodeId === "string") {
        const set = reachedBy.get(payload.nodeId) ?? new Set<string>();
        set.add(job.run_id);
        reachedBy.set(payload.nodeId, set);
      }
    }
    if ((job.status === "skipped" || job.status === "dead_letter") && job.action_type !== "flow_timeout") {
      const reason = String(job.last_error ?? "Motivo não informado").slice(0, 120);
      if (BENIGN_SKIPS.includes(reason)) continue;
      interruptions.set(reason, (interruptions.get(reason) ?? 0) + 1);
    }
  }

  const nodes = new Map(input.flow.nodes.map(node => [node.id, node]));
  const funnel = flowOrder(input.flow)
    .map(id => nodes.get(id))
    .filter((node): node is NonNullable<typeof node> => Boolean(node) && node!.type !== "delay")
    .map(node => ({
      nodeId: node.id,
      type: node.type === "action" ? `action-${node.data.kind}` : node.type,
      title: node.type === "trigger" ? "Entraram" : nodeTitle(node),
      summary: node.type === "trigger" ? "Pessoas que ativaram o gatilho" : describeNode(node),
      reached: node.type === "trigger" ? entered : reachedBy.get(node.id)?.size ?? 0,
    }));

  const tapCounts = new Map<string, number>();
  for (const tap of input.taps) {
    if (!runIds.has(tap.runId)) continue;
    const key = `${tap.nodeId}|${tap.buttonId}`;
    tapCounts.set(key, (tapCounts.get(key) ?? 0) + 1);
  }
  const buttons = input.flow.nodes.flatMap(node => node.type !== "message" ? [] : node.data.buttons
    .filter(button => button.kind === "reply")
    .map(button => ({
      nodeId: node.id,
      message: node.data.text.slice(0, 80),
      buttonId: button.id,
      label: button.label || "Botão",
      taps: tapCounts.get(`${node.id}|${button.id}`) ?? 0,
    })))
    .sort((a, b) => b.taps - a.taps);

  const fieldCounts = new Map<string, number>();
  const countedContacts = new Set<string>();
  for (const run of runs) {
    if (!run.contact_id || countedContacts.has(run.contact_id)) continue;
    countedContacts.add(run.contact_id);
    for (const [key, value] of Object.entries(contacts.get(run.contact_id)?.fields ?? {})) {
      if (value) fieldCounts.set(key, (fieldCounts.get(key) ?? 0) + 1);
    }
  }

  const recent = [...runs]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 8)
    .map(run => {
      const contact = run.contact_id ? contacts.get(run.contact_id) : undefined;
      const fields = contact?.fields ?? {};
      const name = fields.nome || contact?.full_name || (contact?.username ? `@${contact.username}` : "Contato do Instagram");
      return {
        runId: run.id, name, username: contact?.username ?? null,
        whatsapp: fields.whatsapp ?? null, email: fields.email ?? null,
        status: run.status, enteredAt: run.created_at, lead: Boolean(run.crm_lead_id),
      };
    });

  return {
    period: { days: input.days, from: from.toISOString(), to: now.toISOString() },
    totals: {
      entered,
      completed: completedRuns.length,
      inProgress: runs.filter(run => IN_PROGRESS.has(run.status)).length,
      failed: runs.filter(run => run.status === "failed" || run.status === "partial").length,
      completionRate: entered ? completedRuns.length / entered : 0,
      interacted,
      interactionRate: entered ? interacted / entered : 0,
      messagesSent,
      leads: runs.filter(run => run.crm_lead_id).length,
      withData,
      avgCompletionSeconds: durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null,
    },
    previous: input.previous,
    daily: Array.from(daily.values()),
    hours,
    funnel,
    buttons,
    fields: Array.from(fieldCounts.entries()).map(([key, count]) => ({ key, label: insightFieldLabel(key), count })).sort((a, b) => b.count - a.count),
    interruptions: Array.from(interruptions.entries()).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count).slice(0, 6),
    recent,
  };
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

export async function loadAutomationInsights(db: SupabaseClient, automation: Record<string, any>, days: number) {
  const now = new Date();
  const since = new Date(now.getTime() - days * 86_400_000).toISOString();
  const previousSince = new Date(now.getTime() - 2 * days * 86_400_000).toISOString();
  const runsTable = "marketing_instagram_automation_runs";

  const [{ data: runs, error }, previousEntered, previousCompleted] = await Promise.all([
    db.from(runsTable).select("id,status,created_at,completed_at,contact_id,crm_lead_id,variables")
      .eq("automation_id", automation.id).gte("created_at", since)
      .order("created_at", { ascending: false }).limit(5000),
    db.from(runsTable).select("id", { count: "exact", head: true })
      .eq("automation_id", automation.id).gte("created_at", previousSince).lt("created_at", since),
    db.from(runsTable).select("id", { count: "exact", head: true })
      .eq("automation_id", automation.id).eq("status", "completed").gte("created_at", previousSince).lt("created_at", since),
  ]);
  if (error) throw new Error(error.message);
  const runRows = (runs ?? []) as InsightRun[];
  const ids = runRows.map(run => run.id);
  const contactIds = Array.from(new Set(runRows.map(run => run.contact_id).filter((id): id is string => Boolean(id))));

  const jobs: InsightJob[] = [];
  for (const part of chunks(ids, 300)) {
    const { data, error: jobsError } = await db.from("marketing_instagram_automation_jobs")
      .select("run_id,action_type,status,payload,last_error").in("run_id", part);
    if (jobsError) throw new Error(jobsError.message);
    jobs.push(...((data ?? []) as InsightJob[]));
  }
  const contacts: InsightContact[] = [];
  for (const part of chunks(contactIds, 300)) {
    const { data, error: contactsError } = await db.from("marketing_instagram_contacts")
      .select("id,username,full_name,fields").in("id", part);
    if (contactsError) throw new Error(contactsError.message);
    contacts.push(...((data ?? []) as InsightContact[]));
  }
  const { data: postbacks } = await db.from("marketing_instagram_automation_events")
    .select("text").eq("connection_id", automation.connection_id).eq("event_type", "postback")
    .gte("occurred_at", since).like("text", "igflow:%").limit(5000);
  const taps = (postbacks ?? []).flatMap(row => {
    const parsed = parseFlowPayload(String(row.text ?? ""));
    return parsed ? [{ runId: parsed.runId, nodeId: parsed.nodeId, buttonId: parsed.buttonId }] : [];
  });

  let flow: AutomationFlow;
  try {
    flow = automation.flow ? sanitizeFlow(automation.flow) : legacyStepsToFlow({
      triggerType: automation.trigger_type, steps: automation.steps, crmEnabled: automation.crm_enabled,
      crmPipelineId: automation.crm_pipeline_id, crmStageId: automation.crm_stage_id,
    });
  } catch {
    flow = legacyStepsToFlow({ triggerType: automation.trigger_type, steps: [] });
  }

  return buildInsights({
    flow, runs: runRows, jobs, taps, contacts, days, now,
    previous: { entered: previousEntered.count ?? 0, completed: previousCompleted.count ?? 0 },
  });
}
