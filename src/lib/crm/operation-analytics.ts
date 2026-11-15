import type { Lead } from "@/types";

export const CRM_TIME_ZONE = "America/Fortaleza";
export function crmDate(instant: string) {
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: CRM_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return ["year", "month", "day"].map(key => parts.find(part => part.type === key)?.value).join("-");
}
export function formatArrival(lead: Pick<Lead, "received_at" | "entered_at">) {
  const date = lead.received_at ? new Date(lead.received_at) : null;
  if (date && Number.isFinite(date.getTime())) return new Intl.DateTimeFormat("pt-BR", { timeZone: CRM_TIME_ZONE, dateStyle: "short", timeStyle: "short" }).format(date);
  return `${lead.entered_at?.split("-").reverse().join("/") || "Sem data"} · hora não registrada`;
}
export function durationLabel(ms: number | null) {
  if (ms === null || !Number.isFinite(ms)) return "—";
  const minutes = Math.floor(Math.max(0, ms) / 60000);
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}min`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}
export interface TimingStage {
  id: string; pipeline_id: string; order_index: number; is_active: boolean;
  name?: string; color?: string; legacy_column?: string | null; is_won?: boolean; is_lost?: boolean;
  metric_type?: string | null;
}
export interface TimingEvent {
  id?: string; lead_id: string; stage_id: string | null; pipeline_id: string | null; moved_at: string;
  from_stage_id?: string | null; from_column?: string | null; to_column?: string | null;
}
export interface StageVisit { stageId: string; enteredAt: string; exitedAt: string | null; durationMs: number; }
export interface LeadTiming {
  lead: Lead; arrival: string | null; firstAdvanceAt: string | null; firstAdvanceMs: number | null;
  waiting: boolean; waitingSince: string | null; visits: StageVisit[]; transitions: { from: string; to: string; at: string; durationMs: number | null }[];
}
export function summarizeDurations(values: number[]) {
  const sorted = values.filter(value => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  const n = sorted.length;
  return { count: n, average: n ? sorted.reduce((a, b) => a + b, 0) / n : null,
    median: n ? (sorted[Math.floor((n - 1) / 2)] + sorted[Math.ceil((n - 1) / 2)]) / 2 : null,
    p90: n ? sorted[Math.ceil(n * .9) - 1] : null };
}
export function analyzeOperation(leads: Lead[], history: TimingEvent[], stages: TimingStage[], now = Date.now(), slaMinutes = 60) {
  const stageMap = new Map(stages.map(stage => [stage.id, stage]));
  const firstByPipeline = new Map<string, TimingStage>();
  for (const stage of stages.filter(s => s.is_active && !s.is_lost && !s.is_won && !["sale", "lost"].includes(s.metric_type ?? ""))) {
    const prior = firstByPipeline.get(stage.pipeline_id);
    if (!prior || stage.order_index < prior.order_index) firstByPipeline.set(stage.pipeline_id, stage);
  }
  const nextByPipeline = new Map<string, TimingStage>();
  for (const [pipelineId, first] of Array.from(firstByPipeline.entries())) {
    const next = stages.filter(s => s.pipeline_id === pipelineId && s.is_active && !s.is_lost && !s.is_won && !["sale", "lost"].includes(s.metric_type ?? "") && s.order_index > first.order_index).sort((a,b) => a.order_index - b.order_index)[0];
    if (next) nextByPipeline.set(pipelineId, next);
  }
  const byLead = new Map<string, TimingEvent[]>();
  for (const event of history) {
    if (!event.stage_id || !Number.isFinite(Date.parse(event.moved_at)) || Date.parse(event.moved_at) > now) continue;
    const events = byLead.get(event.lead_id) ?? []; events.push(event); byLead.set(event.lead_id, events);
  }
  const timings: LeadTiming[] = leads.map(lead => {
    const arrival = lead.received_at && Number.isFinite(Date.parse(lead.received_at)) && Date.parse(lead.received_at) <= now ? lead.received_at : null;
    const first = firstByPipeline.get(lead.pipeline_id ?? "");
    const current = stageMap.get(lead.stage_id ?? "");
    const events = (byLead.get(lead.id) ?? []).filter(e => e.pipeline_id === lead.pipeline_id && (!arrival || Date.parse(e.moved_at) >= Date.parse(arrival)))
      .sort((a, b) => Date.parse(a.moved_at) - Date.parse(b.moved_at) || (a.id ?? "").localeCompare(b.id ?? ""));
    const result: LeadTiming = { lead, arrival, firstAdvanceAt: null, firstAdvanceMs: null, waiting: false, waitingSince: null, visits: [], transitions: [] };
    let stageId: string | null = null, enteredAt: string | null = null;
    let initialExitRecorded = false;
    for (const event of events) {
      const target = stageMap.get(event.stage_id!);
      if (!target || target.pipeline_id !== lead.pipeline_id) continue;
      const sourceId = event.from_stage_id ?? (event.from_column ? stages.find(s => s.pipeline_id === lead.pipeline_id && s.legacy_column === event.from_column)?.id : null);
      const source = sourceId && stageMap.get(sourceId)?.pipeline_id === lead.pipeline_id ? sourceId : null;
      // An initial record is an entry, not an attended lead. Missing older history stays unknown.
      if (!stageId && source && source !== event.stage_id) {
        stageId = source;
        enteredAt = source === first?.id ? arrival : null;
      }
      if (stageId === event.stage_id) continue; // Ignore no-op saves and repeated deliveries.
      if (stageId) {
        const elapsed = enteredAt ? Date.parse(event.moved_at) - Date.parse(enteredAt) : null;
        if (enteredAt && elapsed !== null && elapsed >= 0) result.visits.push({ stageId, enteredAt, exitedAt: event.moved_at, durationMs: elapsed });
        result.transitions.push({ from: stageId, to: event.stage_id!, at: event.moved_at, durationMs: elapsed });
        if (!initialExitRecorded && stageId === first?.id && target.id === nextByPipeline.get(lead.pipeline_id ?? "")?.id) {
          result.firstAdvanceAt = event.moved_at;
          result.firstAdvanceMs = arrival ? Date.parse(event.moved_at) - Date.parse(arrival) : null;
        }
        if (stageId === first?.id) initialExitRecorded = true;
      }
      if (stageId === null && event.stage_id !== first?.id) initialExitRecorded = true;
      const initialEntry = stageId === null && event.stage_id === first?.id;
      stageId = event.stage_id; enteredAt = initialEntry && arrival ? arrival : event.moved_at;
    }
    if (!stageId && current && first && current.id === first.id) { stageId = current.id; enteredAt = arrival; }
    if (stageId && stageId === lead.stage_id && enteredAt && !current?.is_won && !current?.is_lost && !["sale", "lost"].includes(current?.metric_type ?? "")) {
      result.visits.push({ stageId, enteredAt, exitedAt: null, durationMs: now - Date.parse(enteredAt) });
    }
    result.waiting = !!first && current?.id === first.id;
    if (result.waiting) result.waitingSince = result.visits.find(v => v.stageId === first!.id && v.exitedAt === null)?.enteredAt ?? arrival;
    return result;
  });
  const stageStats = stages.filter(s => s.is_active || timings.some(t => t.visits.some(v => v.stageId === s.id)))
    .sort((a, b) => a.pipeline_id.localeCompare(b.pipeline_id) || a.order_index - b.order_index).map(stage => {
      const visits = timings.flatMap(t => t.visits.filter(v => v.stageId === stage.id));
      const closed = visits.filter(v => v.exitedAt !== null), open = visits.filter(v => v.exitedAt === null);
      const isInitial = firstByPipeline.get(stage.pipeline_id)?.id === stage.id;
      const completed = isInitial
        ? summarizeDurations(timings.filter(t => t.lead.pipeline_id === stage.pipeline_id && t.firstAdvanceMs !== null).map(t => t.firstAdvanceMs!))
        : summarizeDurations(closed.map(v => v.durationMs));
      return { stage, isInitial, nextStageId: isInitial ? nextByPipeline.get(stage.pipeline_id)?.id ?? null : null, allCompleted: summarizeDurations(closed.map(v => v.durationMs)), current: leads.filter(l => l.stage_id === stage.id).length, completed,
        open: summarizeDurations(open.map(v => v.durationMs)), exits: closed.length };
    });
  const transitions = new Map<string, { from: string; to: string; count: number; values: number[] }>();
  for (const t of timings) for (const event of t.transitions) {
    const key = `${event.from}:${event.to}`;
    const row = transitions.get(key) ?? { from: event.from, to: event.to, count: 0, values: [] };
    row.count++; if (event.durationMs !== null) row.values.push(event.durationMs); transitions.set(key, row);
  }
  const waiting = timings.filter(t => t.waiting);
  const measured = timings.filter(t => t.firstAdvanceMs !== null);
  return { timings, stages: stageStats, entryRoutes: Array.from(firstByPipeline.values()).map(from => ({ from, to: nextByPipeline.get(from.pipeline_id) ?? null })), transitions: Array.from(transitions.values()).map(t => ({ ...t, duration: summarizeDurations(t.values) })),
    firstContact: summarizeDurations(measured.map(t => t.firstAdvanceMs!)), waiting: waiting.length,
    overdue: waiting.filter(t => t.waitingSince && now - Date.parse(t.waitingSince) > slaMinutes * 60000).length,
    withinSla: measured.length ? measured.filter(t => t.firstAdvanceMs! <= slaMinutes * 60000).length / measured.length * 100 : null,
    missingArrival: timings.filter(t => !t.arrival).length };
}
