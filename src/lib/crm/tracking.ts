// ─────────────────────────────────────────────────────────────────────────────
// CRM — Rastreamento dos leads (canal, tipo de tráfego, campanha, criativo,
// dispositivo, navegador). Combina o que vem no próprio lead (Meta Lead Ads:
// campanha e anúncio) com a sessão do formulário ou do site que gerou o lead.
// ─────────────────────────────────────────────────────────────────────────────

import type { Lead } from "@/types";
import { classifySource, decodeLabel, DEVICE_LABELS, SOURCE_LABELS } from "@/lib/analytics/report";
import type { OriginAnalysis, OriginRow, SegmentResolver } from "./origin-analytics";

export interface LeadAttribution {
  readonly channel:      "form" | "site";
  readonly device:       string | null;
  readonly browser:      string | null;
  readonly os:           string | null;
  readonly utm_source:   string | null;
  readonly utm_medium:   string | null;
  readonly utm_campaign: string | null;
  readonly utm_term:     string | null;
  readonly utm_content:  string | null;
  readonly referrer:     string | null;
  readonly ad_click:     boolean;
}

export type AttributionMap = Record<string, LeadAttribution>;

export const CHANNEL_COLORS: Record<string, string> = {
  instagram: "#db2777", facebook: "#1877f2", meta_form: "#0866ff", google: "#f59e0b", tiktok: "#14b8a6",
  youtube: "#ef4444", whatsapp: "#22c55e", linkedin: "#0a66c2", email: "#f97316", links: "#10b981",
  site: "#0ea5e9", interno: "#94a3b8", direto: "#8b5cf6", instagram_dm: "#e11d48", sem_rastreio: "#64748b", x: "#a3a3a3",
};

const EXTRA_LABELS: Record<string, string> = {
  meta_form: "Meta (formulário do anúncio)",
  instagram_dm: "Instagram (automação de direct)",
  sem_rastreio: "Sem rastreio",
};

export const channelLabel = (key: string) => EXTRA_LABELS[key] ?? SOURCE_LABELS[key] ?? key;

const isMetaNative = (lead: Lead) => !!lead.leadgen_id || lead.source === "meta_lead_ads";

/** Canal de aquisição: UTM/referência da sessão; sem sessão, o que o próprio lead informa. */
export function channelOf(lead: Lead, attribution?: LeadAttribution): string {
  if (attribution) return classifySource({ utm_source: attribution.utm_source, referrer: attribution.referrer });
  if (isMetaNative(lead)) return "meta_form";
  if (lead.source === "instagram_automation") return "instagram_dm";
  return "sem_rastreio";
}

const PAID_MEDIUM = /(paid|cpc|cpm|ppc|ads?$|ad_|_ads|anuncio|anúncio|patrocinado|display|retarget)/i;

export function trafficOf(lead: Lead, attribution?: LeadAttribution): "pago" | "organico" | "direto" | "sem_rastreio" {
  if (isMetaNative(lead)) return "pago";
  if (!attribution) return lead.source === "instagram_automation" ? "organico" : "sem_rastreio";
  const campaign = attribution.utm_campaign?.trim() ?? "";
  if (attribution.ad_click || PAID_MEDIUM.test(attribution.utm_medium ?? "") || /^\d{8,}$/.test(campaign) || (campaign && attribution.utm_source)) return "pago";
  const channel = channelOf(lead, attribution);
  return channel === "direto" || channel === "interno" ? "direto" : "organico";
}

export const TRAFFIC_INFO: Record<string, { name: string; color: string }> = {
  pago:         { name: "Anúncios", color: "#f59e0b" },
  organico:     { name: "Orgânico / indicação", color: "#10b981" },
  direto:       { name: "Direto", color: "#8b5cf6" },
  sem_rastreio: { name: "Sem rastreio", color: "#64748b" },
};

const DEVICE_COLORS: Record<string, string> = { mobile: "#10b981", desktop: "#0284c7", tablet: "#7c3aed" };

/** Recortes prontos para analyzeSegments. */
export function trackingResolvers(attribution: AttributionMap) {
  const get = (lead: Lead) => attribution[lead.id];
  const channel: SegmentResolver = lead => {
    const key = channelOf(lead, get(lead));
    return { key, name: channelLabel(key), color: CHANNEL_COLORS[key] ?? null };
  };
  const traffic: SegmentResolver = lead => {
    const key = trafficOf(lead, get(lead));
    return { key, ...TRAFFIC_INFO[key] };
  };
  const campaign: SegmentResolver = lead => {
    const raw = get(lead)?.utm_campaign?.trim() || lead.campaign_name?.trim();
    if (!raw) return null;
    const name = decodeLabel(raw);
    return { key: name, name, color: null };
  };
  const creative: SegmentResolver = lead => {
    const raw = get(lead)?.utm_content?.trim() || lead.ad_name?.trim();
    if (!raw) return null;
    const name = decodeLabel(raw);
    return { key: name, name, color: null };
  };
  const form: SegmentResolver = lead => {
    const name = lead.form_name?.trim();
    return name ? { key: name, name, color: null } : null;
  };
  const device: SegmentResolver = lead => {
    const raw = get(lead)?.device?.toLowerCase();
    if (!raw) return null;
    return { key: raw, name: DEVICE_LABELS[raw] ?? raw, color: DEVICE_COLORS[raw] ?? null };
  };
  const browser: SegmentResolver = lead => {
    const raw = get(lead)?.browser;
    if (!raw) return null;
    const name = raw === "Other" ? "Outro" : raw;
    return { key: name, name, color: null };
  };
  const os: SegmentResolver = lead => {
    const raw = get(lead)?.os;
    if (!raw) return null;
    const name = raw === "Other" ? "Outro" : raw;
    return { key: name, name, color: null };
  };
  return { channel, traffic, campaign, creative, form, device, browser, os };
}

// ── Leitura automática ──────────────────────────────────────────────────────


export interface TrackingInsight {
  readonly id:     string;
  readonly tone:   "good" | "attention" | "critical" | "info";
  readonly title:  string;
  readonly detail: string;
}

const fmt = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const minVolume = (analysis: OriginAnalysis) => Math.max(5, Math.round(analysis.total * 0.05));

function bestBy(analysis: OriginAnalysis, metric: "saleRate" | "meetingRate", exclude: string[] = []): { best?: OriginRow; worst?: OriginRow } {
  const eligible = analysis.rows.filter(r => r.leads >= minVolume(analysis) && !exclude.includes(r.key));
  if (eligible.length < 2) return {};
  const sorted = [...eligible].sort((a, b) => b[metric] - a[metric] || b.leads - a.leads);
  return { best: sorted[0], worst: sorted[sorted.length - 1] };
}

export function buildTrackingInsights(input: { origin: OriginAnalysis; channel: OriginAnalysis; traffic: OriginAnalysis; campaign: OriginAnalysis; device: OriginAnalysis; totalLeads: number; trackedLeads: number }): TrackingInsight[] {
  const out: TrackingInsight[] = [];
  if (input.totalLeads < 5) return [{ id: "few", tone: "info", title: "Poucos leads para comparar", detail: `São ${input.totalLeads} leads no período. Amplie o período para comparar origens com mais segurança.` }];

  const hasSales = input.origin.rows.some(r => r.sales > 0);
  const metric = hasSales ? "saleRate" : "meetingRate";
  const metricName = hasSales ? "em venda" : "em reunião";

  const ch = bestBy(input.channel, metric, ["sem_rastreio"]);
  if (ch.best && ch.worst && ch.best.key !== ch.worst.key && ch.best[metric] > ch.worst[metric]) {
    out.push({ id: "channel", tone: "good", title: `${ch.best.name} é o canal que mais converte`, detail: `${fmt(ch.best[metric])} dos leads de ${ch.best.name} viraram ${hasSales ? "venda" : "reunião"}, contra ${fmt(ch.worst[metric])} de ${ch.worst.name}. Vale concentrar verba e conteúdo onde a conversão é maior.` });
  }

  const og = bestBy(input.origin, metric);
  if (og.best && og.worst && og.best.key !== og.worst.key && og.best[metric] - og.worst[metric] >= 5) {
    out.push({ id: "origin", tone: "info", title: `Origem com melhor conversão ${metricName}: ${og.best.name}`, detail: `${og.best.name} converte ${fmt(og.best[metric])}; ${og.worst.name}, ${fmt(og.worst[metric])}. Compare a abordagem do time e a qualificação de cada entrada.` });
  }

  const paid = input.traffic.rows.find(r => r.key === "pago");
  const organic = input.traffic.rows.find(r => r.key === "organico");
  if (paid && organic && paid.leads >= 5 && organic.leads >= 5) {
    const diff = organic[metric] - paid[metric];
    if (Math.abs(diff) >= 5) out.push({ id: "traffic", tone: diff > 0 ? "attention" : "good", title: diff > 0 ? "Orgânico converte mais que anúncio" : "Anúncios convertem mais que orgânico", detail: `Anúncios: ${fmt(paid[metric])} ${metricName} (${paid.leads} leads). Orgânico/indicação: ${fmt(organic[metric])} (${organic.leads} leads).${diff > 0 ? " Revise a segmentação e a promessa dos anúncios." : ""}` });
  }

  const camp = [...input.campaign.rows].filter(r => r.leads >= 3).sort((a, b) => b.sales - a.sales || b.meetings - a.meetings || b.leads - a.leads)[0];
  if (camp && (camp.sales > 0 || camp.meetings > 0)) {
    out.push({ id: "campaign", tone: "good", title: "Campanha que mais gera negócio", detail: `“${camp.name.slice(0, 70)}” trouxe ${camp.leads} leads, ${camp.meetings} com reunião e ${camp.sales} ${camp.sales === 1 ? "venda" : "vendas"}.` });
  }

  const mobile = input.device.rows.find(r => r.key === "mobile");
  const desktop = input.device.rows.find(r => r.key === "desktop");
  if (mobile && desktop && mobile.leads >= 5 && desktop.leads >= 5 && Math.abs(mobile[metric] - desktop[metric]) >= 5) {
    const better = mobile[metric] > desktop[metric] ? mobile : desktop;
    out.push({ id: "device", tone: "info", title: `Leads do ${better.key === "mobile" ? "celular" : "computador"} convertem mais`, detail: `Celular: ${fmt(mobile[metric])} · Computador: ${fmt(desktop[metric])} ${metricName}.` });
  }

  const coverage = input.totalLeads ? (input.trackedLeads / input.totalLeads) * 100 : 0;
  if (coverage < 60) {
    out.push({ id: "coverage", tone: "attention", title: `Só ${fmt(coverage)} dos leads têm rastreio`, detail: "Leads manuais e importados chegam sem UTM. Use links com UTM nos anúncios, na bio e no WhatsApp para saber de onde cada lead veio." });
  }
  return out.slice(0, 6);
}
