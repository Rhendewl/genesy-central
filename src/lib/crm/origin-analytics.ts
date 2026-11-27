// ─────────────────────────────────────────────────────────────────────────────
// CRM — Análise por origem do lead
//
// Função pura: leads + etapas + histórico → métricas por origem.
// A origem vem de leads.origin_id (origens configuradas no CRM, com nome e cor);
// leads antigos sem origin_id usam o slug de leads.source.
// ─────────────────────────────────────────────────────────────────────────────

import type { Lead, LeadOrigin } from "@/types";
import type { TimingEvent, TimingStage } from "./operation-analytics";

export interface OriginRow {
  readonly key:            string;
  readonly name:           string;
  readonly color:          string;
  readonly leads:          number;
  readonly share:          number;        // % dos leads
  readonly qualified:      number;
  readonly meetings:       number;        // chegaram a reunião agendada (ou além)
  readonly meetingsHeld:   number;
  readonly sales:          number;
  readonly lost:           number;
  readonly open:           number;        // nem venda nem perdido
  readonly qualifiedRate:  number;        // %
  readonly meetingRate:    number;        // %
  readonly saleRate:       number;        // %
  readonly revenue:        number;
  readonly avgTicket:      number | null;
  readonly avgIq:          number | null;
  readonly medianFirstContactMs: number | null;
  readonly campaigns:      Array<{ name: string; leads: number; sales: number }>;
  readonly ads:            Array<{ name: string; leads: number; sales: number }>;
  readonly forms:          Array<{ name: string; leads: number; sales: number }>;
}

export interface OriginTimelinePoint {
  readonly key:    string;                 // YYYY-MM-DD (dia ou segunda-feira da semana)
  readonly counts: Record<string, number>; // origem → leads
}

export interface OriginAnalysis {
  readonly rows:      OriginRow[];
  readonly total:     number;
  readonly hasStageMetrics: boolean;
  readonly timeline:  OriginTimelinePoint[];
  readonly timelineUnit: "day" | "week";
}

const FALLBACK_COLORS = ["#2563eb", "#db2777", "#22c55e", "#f59e0b", "#8b5cf6", "#0ea5e9", "#14b8a6", "#ef4444", "#64748b"];

const SOURCE_NAMES: Record<string, string> = {
  manual: "Manual",
  meta_lead_ads: "Meta Lead Ads",
  external_webhook: "Webhook",
  formulario_genesy: "Formulário",
  form: "Formulário",
  website: "Site",
  site: "Site",
  instagram_automation: "Instagram",
};

const titleCase = (value: string) => value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().split(" ").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

export function resolveOrigin(lead: Pick<Lead, "origin_id" | "source">, origins: LeadOrigin[]): { key: string; name: string; color: string | null } {
  const byId = lead.origin_id ? origins.find(o => o.id === lead.origin_id) : undefined;
  const slug = (lead.source || "manual").trim();
  const origin = byId ?? origins.find(o => o.slug === slug);
  if (origin) return { key: origin.id, name: origin.name, color: origin.color };
  return { key: `source:${slug}`, name: SOURCE_NAMES[slug] ?? titleCase(slug), color: null };
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 1000) / 10 : 0);

function topList(entries: Map<string, { leads: number; sales: number }>, limit = 6) {
  return Array.from(entries.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.leads - a.leads || b.sales - a.sales)
    .slice(0, limit);
}

const LEGACY_MEETING = new Set(["reuniao_agendada", "reuniao_realizada", "no_show", "venda_realizada"]);
const LEGACY_HELD = new Set(["reuniao_realizada", "venda_realizada"]);

export type StageKind = "qualified_lead" | "meeting_scheduled" | "meeting_held" | "sale" | "lost";

const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

/**
 * O que a etapa representa para a conversão. Usa a marcação da etapa
 * (venda, perda, métrica); quando ela está vazia, reconhece pelo nome as
 * etapas mais comuns — "Reunião agendada", "Visita realizada", "Perdido"…
 */
export function stageKind(stage: Pick<TimingStage, "name" | "metric_type" | "is_won" | "is_lost">): StageKind | null {
  if (stage.is_won || stage.metric_type === "sale") return "sale";
  if (stage.is_lost || stage.metric_type === "lost") return "lost";
  if (stage.metric_type === "meeting_held" || stage.metric_type === "meeting_scheduled" || stage.metric_type === "qualified_lead") return stage.metric_type as StageKind;
  const name = normalize(stage.name ?? "");
  if (!name) return null;
  if (/(no.?show|sem comparecimento|nao compareceu|faltou)/.test(name)) return "meeting_scheduled";
  if (/(reuniao|visita|apresentacao|call|demonstracao) (realizada|feita|concluida)/.test(name)) return "meeting_held";
  if (/(reuniao|visita|apresentacao|call|demonstracao) (agendada|marcada|confirmada)/.test(name)) return "meeting_scheduled";
  if (/^(vendido|venda (realizada|fechada|concluida)|contrato (fechado|assinado)|ganho|fechado|virou cliente)/.test(name)) return "sale";
  if (/^(perdido|perdidos|perda|declinou|desqualificado|descartado)/.test(name)) return "lost";
  if (/^(qualificado|lead qualificado|qualificada)$/.test(name)) return "qualified_lead";
  return null;
}

export type SegmentResolver = (lead: Lead) => { key: string; name: string; color: string | null } | null;

export interface SegmentInput {
  leads:    Lead[];
  stages:   TimingStage[];
  history:  TimingEvent[];
  firstContactMs?: Map<string, number | null>;
  timeZone?: string;
}

/** Métricas por origem cadastrada no CRM (crm_lead_origins). */
export function analyzeOrigins(input: SegmentInput & { origins: LeadOrigin[] }): OriginAnalysis {
  return analyzeSegments(input, lead => resolveOrigin(lead, input.origins));
}

/**
 * Métricas por qualquer recorte de lead (origem, canal da UTM, campanha,
 * dispositivo…). Leads para os quais o recorte devolve null ficam de fora.
 */
export function analyzeSegments(input: SegmentInput, resolve: SegmentResolver): OriginAnalysis {
  const { stages, history } = input;
  const resolved = new Map<string, { key: string; name: string; color: string | null }>();
  const leads = input.leads.filter(lead => {
    const segment = resolve(lead);
    if (segment) resolved.set(lead.id, segment);
    return !!segment;
  });
  const stageById = new Map(stages.map(stage => [stage.id, stage]));
  const hasStageMetrics = stages.some(stage => stageKind(stage) !== null);

  // Etapas por onde cada lead passou (na pipeline atual), para medir se chegou a reunião/venda.
  const visited = new Map<string, Set<string>>();
  for (const event of history) {
    if (!event.stage_id) continue;
    const set = visited.get(event.lead_id) ?? new Set<string>();
    set.add(event.stage_id);
    visited.set(event.lead_id, set);
  }

  const reached = (lead: Lead, test: (stage: TimingStage) => boolean) => {
    const ids = new Set(visited.get(lead.id) ?? []);
    if (lead.stage_id) ids.add(lead.stage_id);
    let hit = false;
    ids.forEach(id => {
      const stage = stageById.get(id);
      if (stage && stage.pipeline_id === (lead.pipeline_id ?? stage.pipeline_id) && test(stage)) hit = true;
    });
    return hit;
  };
  const kind = (s: TimingStage) => stageKind(s);
  const isSale = (s: TimingStage) => kind(s) === "sale";
  const isLost = (s: TimingStage) => kind(s) === "lost";
  const isHeld = (s: TimingStage) => kind(s) === "meeting_held" || isSale(s);
  const isMeeting = (s: TimingStage) => kind(s) === "meeting_scheduled" || isHeld(s);
  const isQualified = (s: TimingStage) => kind(s) === "qualified_lead" || isMeeting(s);

  type Acc = {
    name: string; color: string | null; leads: number; qualified: number; meetings: number; held: number; sales: number; lost: number;
    revenue: number; iq: number[]; firstContact: number[];
    campaigns: Map<string, { leads: number; sales: number }>; ads: Map<string, { leads: number; sales: number }>; forms: Map<string, { leads: number; sales: number }>;
  };
  const acc = new Map<string, Acc>();
  const bump = (map: Map<string, { leads: number; sales: number }>, name: string | null, sale: boolean) => {
    const key = name?.trim();
    if (!key) return;
    const row = map.get(key) ?? { leads: 0, sales: 0 };
    row.leads++;
    if (sale) row.sales++;
    map.set(key, row);
  };

  for (const lead of leads) {
    const origin = resolved.get(lead.id)!;
    const row: Acc = acc.get(origin.key) ?? {
      name: origin.name, color: origin.color, leads: 0, qualified: 0, meetings: 0, held: 0, sales: 0, lost: 0, revenue: 0, iq: [], firstContact: [],
      campaigns: new Map(), ads: new Map(), forms: new Map(),
    };
    const col = lead.kanban_column;
    const sale = hasStageMetrics ? reached(lead, isSale) : col === "venda_realizada";
    const lost = !sale && (hasStageMetrics ? reached(lead, isLost) : false);
    const meeting = hasStageMetrics ? reached(lead, isMeeting) : LEGACY_MEETING.has(col);
    const held = hasStageMetrics ? reached(lead, isHeld) : LEGACY_HELD.has(col);
    const qualified = hasStageMetrics ? reached(lead, isQualified) : meeting || col === "formulario_aplicado";

    row.leads++;
    if (qualified) row.qualified++;
    if (meeting) row.meetings++;
    if (held) row.held++;
    if (sale) { row.sales++; row.revenue += Number(lead.deal_value) || 0; }
    if (lost) row.lost++;
    if (typeof lead.iq_score === "number") row.iq.push(lead.iq_score);
    const first = input.firstContactMs?.get(lead.id);
    if (typeof first === "number" && first >= 0) row.firstContact.push(first);
    bump(row.campaigns, lead.campaign_name, sale);
    bump(row.ads, lead.ad_name, sale);
    bump(row.forms, lead.form_name, sale);
    acc.set(origin.key, row);
  }

  const total = leads.length;
  let colorIndex = 0;
  const rows: OriginRow[] = Array.from(acc.entries())
    .sort((a, b) => b[1].leads - a[1].leads)
    .map(([key, row]) => ({
      key,
      name: row.name,
      color: row.color ?? FALLBACK_COLORS[colorIndex++ % FALLBACK_COLORS.length],
      leads: row.leads,
      share: pct(row.leads, total),
      qualified: row.qualified,
      meetings: row.meetings,
      meetingsHeld: row.held,
      sales: row.sales,
      lost: row.lost,
      open: row.leads - row.sales - row.lost,
      qualifiedRate: pct(row.qualified, row.leads),
      meetingRate: pct(row.meetings, row.leads),
      saleRate: pct(row.sales, row.leads),
      revenue: row.revenue,
      avgTicket: row.sales ? row.revenue / row.sales : null,
      avgIq: row.iq.length ? Math.round(row.iq.reduce((a, b) => a + b, 0) / row.iq.length) : null,
      medianFirstContactMs: median(row.firstContact),
      campaigns: topList(row.campaigns),
      ads: topList(row.ads),
      forms: topList(row.forms),
    }));

  // ── Chegada de leads por origem ao longo do tempo ──────────────────────────
  const tz = input.timeZone ?? "America/Fortaleza";
  const dayOf = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const days = leads.map(lead => dayOf.format(new Date(lead.received_at ?? lead.created_at)));
  const sortedDays = [...days].sort();
  const spanDays = sortedDays.length ? (Date.parse(sortedDays[sortedDays.length - 1]) - Date.parse(sortedDays[0])) / 86_400_000 : 0;
  const timelineUnit: "day" | "week" = spanDays > 45 ? "week" : "day";
  const keyOf = (day: string) => {
    if (timelineUnit === "day") return day;
    const d = new Date(`${day}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  };
  const timelineMap = new Map<string, Record<string, number>>();
  if (sortedDays.length) {
    const end = Date.parse(`${sortedDays[sortedDays.length - 1]}T12:00:00Z`);
    for (let t = Date.parse(`${sortedDays[0]}T12:00:00Z`); t <= end; t += 86_400_000) {
      const key = keyOf(new Date(t).toISOString().slice(0, 10));
      if (!timelineMap.has(key)) timelineMap.set(key, {});
    }
  }
  leads.forEach((lead, index) => {
    const key = keyOf(days[index]);
    const counts = timelineMap.get(key) ?? {};
    const origin = resolved.get(lead.id)!.key;
    counts[origin] = (counts[origin] ?? 0) + 1;
    timelineMap.set(key, counts);
  });
  const timeline = Array.from(timelineMap.entries()).map(([key, counts]) => ({ key, counts })).sort((a, b) => a.key.localeCompare(b.key));

  return { rows, total, hasStageMetrics, timeline, timelineUnit };
}
