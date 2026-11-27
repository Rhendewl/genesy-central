// ─────────────────────────────────────────────────────────────────────────────
// Analytics — Relatório de Insights do formulário (v2)
//
// Função pura: linhas do banco → relatório pronto para a aba Insights.
// Diferente do InsightsDomain (v1), o relatório não depende só de form_events:
// sessões e respostas (que sempre foram gravadas) bastam para acessos, início,
// conclusão, funil por pergunta, origem, campanha, dispositivo e horários.
// Eventos, quando existem, acrescentam tempo por pergunta e trocas de resposta.
// ─────────────────────────────────────────────────────────────────────────────

export type ReportGranularity = "hour" | "day" | "week" | "month";

export interface ReportStep {
  readonly id:    string;
  readonly title: string;
  readonly type?: string;
}

export interface ReportSession {
  readonly id:           string;
  readonly device:       string | null;
  readonly browser:      string | null;
  readonly os:           string | null;
  readonly utm_source:   string | null;
  readonly utm_medium:   string | null;
  readonly utm_campaign: string | null;
  readonly utm_content:  string | null;
  readonly utm_term?:    string | null;
  readonly referrer:     string | null;
  readonly fbclid?:      string | null;
  readonly gclid?:       string | null;
  readonly started_at:   string;
  readonly finished_at:  string | null;
}

export interface ReportSubmission {
  readonly session_id: string | null;
  readonly status:     string;
  readonly score:      number | null;
  readonly created_at: string;
  readonly answers:    Record<string, unknown> | null;
}

export interface ReportEvent {
  readonly session_id: string | null;
  readonly event:      string;
  readonly step_id:    string | null;
  readonly duration:   number | null;
  readonly created_at: string;
}

export interface FormReportInput {
  readonly steps:        ReportStep[];
  readonly sessions:     ReportSession[];
  readonly submissions:  ReportSubmission[];
  readonly events:       ReportEvent[];
  readonly granularity:  ReportGranularity;
  readonly since?:       string;
  readonly until?:       string;
  /** Fuso de leitura dos horários, em minutos. Padrão: UTC−3 (João Pessoa). */
  readonly tzOffsetMinutes?: number;
  readonly now?:         number;
}

export interface ReportSummary {
  readonly visits:              number;
  readonly started:             number;
  readonly completed:           number;
  readonly partialLeads:        number;   // saíram no meio, mas deixaram respostas
  readonly startRate:           number;   // iniciaram / acessos (%)
  readonly completionRate:      number;   // concluíram / iniciaram (%)
  readonly conversionRate:      number;   // concluíram / acessos (%)
  readonly abandonRate:         number;   // iniciaram e não concluíram / iniciaram (%)
  readonly bounceRate:          number;   // não iniciaram / acessos (%)
  readonly avgCompletionSecs:   number | null;
  readonly medianCompletionSecs: number | null;
  readonly avgScreenSecs:       number | null;   // tempo de tela por acesso com atividade
  readonly avgProgressPct:      number | null;   // % das perguntas respondidas por quem iniciou
  readonly avgScore:            number | null;
}

export interface ReportTimelinePoint {
  readonly key:       string;
  readonly visits:    number;
  readonly started:   number;
  readonly completed: number;
}

export interface ReportFunnelStage {
  readonly key:   string;
  readonly label: string;
  readonly value: number;
}

export interface ReportQuestion {
  readonly stepId:          string;
  readonly index:           number;     // posição entre as perguntas respondíveis (0..)
  readonly title:           string;
  readonly type?:           string;
  readonly answered:        number;     // sessões que responderam
  readonly droppedHere:     number;     // pararam nesta pergunta (não responderam e não concluíram)
  readonly dropRate:        number;     // droppedHere / (answered + droppedHere) (%)
  readonly reachRate:       number;     // answered / iniciaram (%)
  readonly medianSecs:      number | null;
  readonly answerChanges:   number;
}

export interface ReportSegment {
  readonly key:            string;
  readonly label:          string;
  readonly visits:         number;
  readonly started:        number;
  readonly completed:      number;
  readonly share:          number;   // % dos acessos
  readonly conversionRate: number;   // completed / visits (%)
}

export interface ReportHeatCell {
  readonly weekday:   number;   // 0 = domingo
  readonly hour:      number;   // 0..23
  readonly visits:    number;
  readonly completed: number;
}

export interface FormReport {
  readonly summary:      ReportSummary;
  readonly timeline:     ReportTimelinePoint[];
  readonly funnel:       ReportFunnelStage[];
  readonly questions:    ReportQuestion[];
  readonly sources:      ReportSegment[];
  readonly trafficTypes: ReportSegment[];
  readonly campaigns:    ReportSegment[];
  readonly contents:     ReportSegment[];
  readonly devices:      ReportSegment[];
  readonly browsers:     ReportSegment[];
  readonly heatmap:      ReportHeatCell[];
  readonly hasStepTiming: boolean;
  readonly granularity:  ReportGranularity;
  readonly computedAt:   string;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const NON_INPUT_TYPES = new Set(["statement", "redirect"]);
const MAX_SESSION_MS  = 30 * 60 * 1000;
const DEFAULT_TZ      = -180;
const STARTED_EVENTS  = new Set(["session_started", "welcome_started", "step_completed", "submission_started"]);

export const SOURCE_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook:  "Facebook",
  google:    "Google",
  tiktok:    "TikTok",
  youtube:   "YouTube",
  whatsapp:  "WhatsApp",
  linkedin:  "LinkedIn",
  x:         "X (Twitter)",
  email:     "E-mail",
  links:     "Links Genesy",
  site:      "Site Genesy",
  interno:   "Painel (testes internos)",
  direto:    "Direto",
};

export const TRAFFIC_LABELS: Record<string, string> = {
  pago:     "Anúncios",
  organico: "Orgânico / indicação",
  direto:   "Direto",
};

export const DEVICE_LABELS: Record<string, string> = {
  mobile:  "Celular",
  desktop: "Computador",
  tablet:  "Tablet",
  desconhecido: "Não identificado",
};

// ── Utilitários ───────────────────────────────────────────────────────────────

const pct = (part: number, total: number) => (total > 0 ? (part / total) * 100 : 0);
const round1 = (value: number) => Math.round(value * 10) / 10;

export function stripTitle(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function hasAnswer(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return null; }
}

export function decodeLabel(value: string): string {
  let text = value.trim();
  try { text = decodeURIComponent(text.replace(/\+/g, " ")); } catch { /* mantém o original */ }
  return text.replace(/\s+/g, " ").trim();
}

/** Normaliza a origem do acesso: utm_source primeiro; sem UTM, o site de onde a pessoa veio. */
export function classifySource(session: Pick<ReportSession, "utm_source" | "referrer">): string {
  const utm = session.utm_source?.trim().toLowerCase();
  if (utm) {
    if (/^(ig|insta|instagram)/.test(utm)) return "instagram";
    if (/^(fb|facebook|meta|an$|audience_network|messenger)/.test(utm)) return "facebook";
    if (/^(google|gads|adwords|google_ads|youtube_ads)/.test(utm)) return "google";
    if (/^(tiktok|tt$)/.test(utm)) return "tiktok";
    if (/^(youtube|yt$)/.test(utm)) return "youtube";
    if (/^(whatsapp|wa$|wpp|zap)/.test(utm)) return "whatsapp";
    if (/^(email|e-mail|newsletter|mail)/.test(utm)) return "email";
    if (/^linkedin/.test(utm)) return "linkedin";
    return decodeLabel(utm);
  }
  const host = hostOf(session.referrer);
  if (!host) return "direto";
  if (host.includes("instagram.")) return "instagram";
  if (host.includes("facebook.") || host === "fb.com" || host.endsWith(".fb.com")) return "facebook";
  if (/(^|\.)google\./.test(host)) return "google";
  if (host.includes("tiktok.")) return "tiktok";
  if (host.includes("youtube.") || host === "youtu.be") return "youtube";
  if (host.includes("whatsapp.") || host === "wa.me") return "whatsapp";
  if (host.includes("linkedin.") || host === "lnkd.in") return "linkedin";
  if (host === "t.co" || host === "x.com" || host.includes("twitter.")) return "x";
  if (host === "go.genesycompany.com") return "links";
  if (host === "dash.genesycompany.com" || host === "localhost") return "interno";
  if (host.endsWith("genesycompany.com")) return "site";
  return host;
}

const PAID_MEDIUM = /(paid|cpc|cpm|ppc|ads?$|ad_|_ads|anuncio|anúncio|patrocinado|display|retarget)/i;

/** Anúncio, orgânico ou direto — para separar o que é mídia paga do que é alcance natural. */
export function classifyTraffic(session: ReportSession): "pago" | "organico" | "direto" {
  const medium = session.utm_medium ?? "";
  const campaign = session.utm_campaign ?? "";
  if (session.fbclid || session.gclid || PAID_MEDIUM.test(medium) || /^\d{8,}$/.test(campaign.trim())) return "pago";
  if (campaign.trim() && session.utm_source) return "pago";
  const source = classifySource(session);
  if (source === "direto" || source === "interno") return "direto";
  return "organico";
}

function localParts(iso: string, tz: number) {
  const d = new Date(Date.parse(iso) + tz * 60_000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), day: d.getUTCDate(), h: d.getUTCHours(), wd: d.getUTCDay(), date: d };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function bucketKey(iso: string, g: ReportGranularity, tz = DEFAULT_TZ): string {
  const p = localParts(iso, tz);
  if (g === "hour")  return `${p.y}-${pad(p.m + 1)}-${pad(p.day)}T${pad(p.h)}`;
  if (g === "day")   return `${p.y}-${pad(p.m + 1)}-${pad(p.day)}`;
  if (g === "month") return `${p.y}-${pad(p.m + 1)}`;
  const monday = new Date(Date.UTC(p.y, p.m, p.day - ((p.wd + 6) % 7)));
  return `${monday.getUTCFullYear()}-${pad(monday.getUTCMonth() + 1)}-${pad(monday.getUTCDate())}`;
}

/** Todos os intervalos entre o começo e o fim, para o gráfico não pular dias sem acesso. */
function bucketRange(fromIso: string, toIso: string, g: ReportGranularity, tz: number): string[] {
  const keys: string[] = [];
  const stepMs = g === "hour" ? 3_600_000 : 86_400_000;
  let cursor = Date.parse(fromIso);
  const end = Date.parse(toIso);
  if (!Number.isFinite(cursor) || !Number.isFinite(end) || end < cursor) return keys;
  let guard = 0;
  while (cursor <= end + stepMs && guard < 2000) {
    const key = bucketKey(new Date(cursor).toISOString(), g, tz);
    if (keys[keys.length - 1] !== key && !keys.includes(key)) keys.push(key);
    cursor += g === "month" ? 86_400_000 * 27 : stepMs;
    guard++;
  }
  const last = bucketKey(toIso, g, tz);
  if (!keys.includes(last)) keys.push(last);
  return keys.filter(key => key <= last);
}

// ── Construção ────────────────────────────────────────────────────────────────

interface SessionFacts {
  readonly session:   ReportSession;
  readonly answered:  Set<string>;
  readonly started:   boolean;
  readonly completed: boolean;
  readonly partialLead: boolean;
  readonly screenMs:  number | null;
  readonly completionMs: number | null;
  readonly furthest:  number;   // maior índice de pergunta respondida (−1 = nenhuma)
}

function segmentRows(
  facts: SessionFacts[],
  keyOf: (f: SessionFacts) => string | null,
  labelOf: (key: string) => string,
  limit = 12,
): ReportSegment[] {
  const total = facts.length;
  const map = new Map<string, { visits: number; started: number; completed: number }>();
  for (const f of facts) {
    const key = keyOf(f);
    if (key === null) continue;
    const row = map.get(key) ?? { visits: 0, started: 0, completed: 0 };
    row.visits++;
    if (f.started) row.started++;
    if (f.completed) row.completed++;
    map.set(key, row);
  }
  return Array.from(map.entries())
    .map(([key, row]) => ({
      key,
      label: labelOf(key),
      ...row,
      share: round1(pct(row.visits, total)),
      conversionRate: round1(pct(row.completed, row.visits)),
    }))
    .sort((a, b) => b.visits - a.visits || b.completed - a.completed)
    .slice(0, limit);
}

export function buildFormReport(input: FormReportInput): FormReport {
  const tz = input.tzOffsetMinutes ?? DEFAULT_TZ;
  const questions = input.steps.filter(step => !NON_INPUT_TYPES.has(step.type ?? ""));
  const questionIndex = new Map(questions.map((step, index) => [step.id, index]));

  const submissionBySession = new Map<string, ReportSubmission>();
  for (const sub of input.submissions) {
    if (!sub.session_id) continue;
    const current = submissionBySession.get(sub.session_id);
    if (!current || (current.status !== "completed" && sub.status === "completed")) submissionBySession.set(sub.session_id, sub);
  }

  const eventsBySession = new Map<string, ReportEvent[]>();
  for (const evt of input.events) {
    if (!evt.session_id) continue;
    const list = eventsBySession.get(evt.session_id);
    if (list) list.push(evt); else eventsBySession.set(evt.session_id, [evt]);
  }

  const facts: SessionFacts[] = input.sessions.map(session => {
    const sub = submissionBySession.get(session.id);
    const events = eventsBySession.get(session.id) ?? [];
    const answered = new Set<string>();
    for (const [stepId, value] of Object.entries(sub?.answers ?? {})) {
      if (questionIndex.has(stepId) && hasAnswer(value)) answered.add(stepId);
    }
    for (const evt of events) {
      if (evt.event === "step_completed" && evt.step_id && questionIndex.has(evt.step_id)) answered.add(evt.step_id);
    }
    const completed = sub?.status === "completed";
    const started = completed || answered.size > 0 || events.some(evt => STARTED_EVENTS.has(evt.event));
    const startedAt = Date.parse(session.started_at);
    const activity = [
      ...events.map(evt => Date.parse(evt.created_at)),
      sub ? Date.parse(sub.created_at) : NaN,
      session.finished_at ? Date.parse(session.finished_at) : NaN,
    ].filter(Number.isFinite);
    const lastActivity = activity.length ? Math.max(...activity) : NaN;
    const screen = Number.isFinite(lastActivity) ? lastActivity - startedAt : NaN;
    const finished = completed && session.finished_at ? Date.parse(session.finished_at) - startedAt : NaN;
    let furthest = -1;
    answered.forEach(id => { furthest = Math.max(furthest, questionIndex.get(id) ?? -1); });
    return {
      session,
      answered,
      started,
      completed,
      partialLead: !completed && answered.size > 0,
      screenMs: screen > 0 && screen <= MAX_SESSION_MS ? screen : null,
      completionMs: finished > 0 && finished <= MAX_SESSION_MS ? finished : null,
      furthest,
    };
  });

  // ── Resumo ────────────────────────────────────────────────────────────────
  const visits = facts.length;
  const started = facts.filter(f => f.started).length;
  const completed = facts.filter(f => f.completed).length;
  const completionTimes = facts.flatMap(f => (f.completionMs === null ? [] : [f.completionMs / 1000]));
  const screenTimes = facts.flatMap(f => (f.screenMs === null ? [] : [f.screenMs / 1000]));
  const progress = questions.length
    ? facts.filter(f => f.started).map(f => (f.completed ? 100 : pct(f.answered.size, questions.length)))
    : [];
  const scores = facts.flatMap(f => {
    const score = submissionBySession.get(f.session.id)?.score;
    return f.completed && typeof score === "number" ? [score] : [];
  });

  const avgCompletion = average(completionTimes);
  const medCompletion = median(completionTimes);
  const avgScreen = average(screenTimes);
  const avgProgress = average(progress);
  const avgScore = average(scores);

  const summary: ReportSummary = {
    visits,
    started,
    completed,
    partialLeads: facts.filter(f => f.partialLead).length,
    startRate: round1(pct(started, visits)),
    completionRate: round1(pct(completed, started)),
    conversionRate: round1(pct(completed, visits)),
    abandonRate: round1(pct(started - completed, started)),
    bounceRate: round1(pct(visits - started, visits)),
    avgCompletionSecs: avgCompletion === null ? null : Math.round(avgCompletion),
    medianCompletionSecs: medCompletion === null ? null : Math.round(medCompletion),
    avgScreenSecs: avgScreen === null ? null : Math.round(avgScreen),
    avgProgressPct: avgProgress === null ? null : Math.round(avgProgress),
    avgScore: avgScore === null ? null : Math.round(avgScore),
  };

  // ── Linha do tempo ────────────────────────────────────────────────────────
  const timelineMap = new Map<string, { visits: number; started: number; completed: number }>();
  const firstIso = input.since ?? input.sessions[0]?.started_at;
  const lastIso = input.until ?? new Date(input.now ?? Date.now()).toISOString();
  if (firstIso && input.granularity !== "month") {
    for (const key of bucketRange(firstIso, lastIso, input.granularity, tz)) timelineMap.set(key, { visits: 0, started: 0, completed: 0 });
  }
  for (const f of facts) {
    const key = bucketKey(f.session.started_at, input.granularity, tz);
    const row = timelineMap.get(key) ?? { visits: 0, started: 0, completed: 0 };
    row.visits++;
    if (f.started) row.started++;
    if (f.completed) row.completed++;
    timelineMap.set(key, row);
  }
  const timeline = Array.from(timelineMap.entries())
    .map(([key, row]) => ({ key, ...row }))
    .sort((a, b) => a.key.localeCompare(b.key));

  // ── Perguntas ─────────────────────────────────────────────────────────────
  const stepDurations = new Map<string, number[]>();
  const changes = new Map<string, number>();
  for (const evt of input.events) {
    if (!evt.step_id) continue;
    if (evt.event === "step_completed" && evt.duration != null && evt.duration >= 0 && evt.duration <= 1800) {
      const list = stepDurations.get(evt.step_id) ?? [];
      list.push(evt.duration);
      stepDurations.set(evt.step_id, list);
    }
    if (evt.event === "answer_changed") changes.set(evt.step_id, (changes.get(evt.step_id) ?? 0) + 1);
  }

  const questionRows: ReportQuestion[] = questions.map((step, index) => {
    const answered = facts.filter(f => f.answered.has(step.id)).length;
    // Parou aqui: iniciou, não concluiu e a última pergunta respondida é a anterior a esta.
    const droppedHere = facts.filter(f => f.started && !f.completed && f.furthest === index - 1).length;
    const med = median(stepDurations.get(step.id) ?? []);
    return {
      stepId: step.id,
      index,
      title: stripTitle(step.title) || `Pergunta ${index + 1}`,
      type: step.type,
      answered,
      droppedHere,
      dropRate: round1(pct(droppedHere, answered + droppedHere)),
      reachRate: round1(pct(answered, started)),
      medianSecs: med === null ? null : Math.round(med),
      answerChanges: changes.get(step.id) ?? 0,
    };
  });

  const funnel: ReportFunnelStage[] = [
    { key: "visits", label: "Acessaram", value: visits },
    { key: "started", label: "Iniciaram", value: started },
    ...questionRows.map(q => ({ key: q.stepId, label: q.title, value: q.answered })),
    { key: "completed", label: "Concluíram", value: completed },
  ];

  // ── Segmentos ─────────────────────────────────────────────────────────────
  const sources = segmentRows(facts, f => classifySource(f.session), key => SOURCE_LABELS[key] ?? key);
  const trafficTypes = segmentRows(facts, f => classifyTraffic(f.session), key => TRAFFIC_LABELS[key] ?? key, 3);
  const campaigns = segmentRows(facts, f => (f.session.utm_campaign?.trim() ? decodeLabel(f.session.utm_campaign) : null), key => key, 10);
  const contents = segmentRows(facts, f => (f.session.utm_content?.trim() ? decodeLabel(f.session.utm_content) : null), key => key, 10);
  const devices = segmentRows(facts, f => (f.session.device?.toLowerCase() || "desconhecido"), key => DEVICE_LABELS[key] ?? key, 4);
  const browsers = segmentRows(facts, f => f.session.browser || "Outro", key => (key === "Other" ? "Outro" : key), 6);

  // ── Mapa de calor (dia da semana × hora, no fuso local) ──────────────────
  const heat = new Map<string, ReportHeatCell>();
  for (const f of facts) {
    const p = localParts(f.session.started_at, tz);
    const key = `${p.wd}-${p.h}`;
    const cell = heat.get(key) ?? { weekday: p.wd, hour: p.h, visits: 0, completed: 0 };
    heat.set(key, { ...cell, visits: cell.visits + 1, completed: cell.completed + (f.completed ? 1 : 0) });
  }

  return {
    summary,
    timeline,
    funnel,
    questions: questionRows,
    sources,
    trafficTypes,
    campaigns,
    contents,
    devices,
    browsers,
    heatmap: Array.from(heat.values()),
    hasStepTiming: stepDurations.size > 0,
    granularity: input.granularity,
    computedAt: new Date(input.now ?? Date.now()).toISOString(),
  };
}

// ── Recomendações ─────────────────────────────────────────────────────────────

export interface ReportRecommendation {
  readonly id:       string;
  readonly tone:     "good" | "attention" | "critical" | "info";
  readonly title:    string;
  readonly detail:   string;
}

const WEEKDAYS_AT = ["no domingo", "na segunda", "na terça", "na quarta", "na quinta", "na sexta", "no sábado"];

/** Leitura automática do relatório: o que está indo bem e o que vale otimizar primeiro. */
export function buildRecommendations(report: FormReport, opts: { totalSteps?: number } = {}): ReportRecommendation[] {
  const out: ReportRecommendation[] = [];
  const s = report.summary;
  if (s.visits < 10) {
    out.push({ id: "few-visits", tone: "info", title: "Poucos acessos para conclusões firmes", detail: `São ${s.visits} acessos no período. As taxas ficam mais confiáveis a partir de algumas dezenas de visitas.` });
    return out;
  }

  if (s.bounceRate >= 60) {
    out.push({ id: "bounce", tone: "critical", title: `${Math.round(s.bounceRate)}% saem sem responder nada`, detail: "A primeira impressão não está convencendo. Teste um título mais direto, uma primeira pergunta mais fácil (nome ou múltipla escolha) e confira se a página do anúncio promete o mesmo que o formulário." });
  } else if (s.bounceRate >= 40) {
    out.push({ id: "bounce", tone: "attention", title: `${Math.round(s.bounceRate)}% dos acessos não iniciam`, detail: "Uma boa parte chega e desiste antes da primeira resposta. Revise a abertura do formulário e a coerência com o anúncio." });
  }

  const worst = [...report.questions].filter(q => q.answered + q.droppedHere >= 5).sort((a, b) => b.droppedHere - a.droppedHere)[0];
  if (worst && worst.droppedHere > 0 && worst.dropRate >= 15) {
    out.push({ id: `drop-${worst.stepId}`, tone: worst.dropRate >= 35 ? "critical" : "attention", title: `Maior perda: “${worst.title.slice(0, 60)}”`, detail: `${worst.droppedHere} pessoas pararam nesta pergunta (${Math.round(worst.dropRate)}% de quem chegou nela). Simplifique o texto, ofereça opções prontas ou mova a pergunta para depois do contato.` });
  }

  const sources = report.sources.filter(src => src.visits >= 10 && src.key !== "interno");
  if (sources.length >= 2) {
    const best = [...sources].sort((a, b) => b.conversionRate - a.conversionRate)[0];
    const worstSrc = [...sources].sort((a, b) => a.conversionRate - b.conversionRate)[0];
    if (best.key !== worstSrc.key && best.conversionRate - worstSrc.conversionRate >= 5) {
      out.push({ id: "sources", tone: "good", title: `${best.label} converte melhor`, detail: `${best.label} converte ${best.conversionRate.toLocaleString("pt-BR")}% dos acessos, contra ${worstSrc.conversionRate.toLocaleString("pt-BR")}% de ${worstSrc.label}. Vale priorizar verba e conteúdo onde a conversão é maior.` });
    }
  }

  const mobile = report.devices.find(d => d.key === "mobile");
  const desktop = report.devices.find(d => d.key === "desktop");
  if (mobile && desktop && mobile.visits >= 10 && desktop.visits >= 10) {
    const gap = desktop.conversionRate - mobile.conversionRate;
    if (gap >= 5) out.push({ id: "mobile", tone: "attention", title: "No celular converte menos", detail: `Celular converte ${mobile.conversionRate.toLocaleString("pt-BR")}% e computador ${desktop.conversionRate.toLocaleString("pt-BR")}%. Teste o formulário no celular: campos longos, teclado cobrindo o botão e textos grandes costumam pesar.` });
    else if (-gap >= 5) out.push({ id: "desktop", tone: "info", title: "No computador converte menos", detail: `Computador converte ${desktop.conversionRate.toLocaleString("pt-BR")}% e celular ${mobile.conversionRate.toLocaleString("pt-BR")}%. Quem chega pelo computador pode estar vindo de testes internos ou de links menos qualificados.` });
  }

  const interno = report.sources.find(src => src.key === "interno");
  if (interno && interno.share >= 10) {
    out.push({ id: "internal", tone: "info", title: `${Math.round(interno.share)}% dos acessos vieram do próprio painel`, detail: "São aberturas pela pré-visualização ou pelo link copiado do painel. Elas puxam a conversão para baixo; considere-as ao comparar períodos." });
  }

  const cells = report.heatmap.filter(c => c.visits >= 3);
  if (cells.length >= 4) {
    const byDay = new Map<number, { visits: number; completed: number }>();
    for (const c of report.heatmap) {
      const d = byDay.get(c.weekday) ?? { visits: 0, completed: 0 };
      byDay.set(c.weekday, { visits: d.visits + c.visits, completed: d.completed + c.completed });
    }
    const bestDay = Array.from(byDay.entries()).filter(([, d]) => d.visits >= 5).sort((a, b) => b[1].completed - a[1].completed)[0];
    if (bestDay && bestDay[1].completed > 0) {
      out.push({ id: "best-day", tone: "info", title: `Mais conversões ${WEEKDAYS_AT[bestDay[0]]}`, detail: `${bestDay[1].completed} envios em ${bestDay[1].visits} acessos nesse dia da semana. Use essa janela para impulsionar anúncios e responder os leads mais rápido.` });
    }
  }

  if (opts.totalSteps && opts.totalSteps > 9) {
    out.push({ id: "length", tone: "info", title: "Formulário longo", detail: `${opts.totalSteps} etapas. Formulários de até 7 perguntas costumam concluir mais; deixe o que não for essencial para o atendimento.` });
  }

  if (s.started >= 10 && s.completionRate >= 70) {
    out.push({ id: "good-completion", tone: "good", title: `Quem começa, termina: ${Math.round(s.completionRate)}% de conclusão`, detail: "O fluxo de perguntas está bom. O ganho agora está em trazer mais gente qualificada para o início." });
  }

  return out.slice(0, 6);
}
