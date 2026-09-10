import type { TrafficReportCampaign, TrafficReportData } from "@/types/traffic-report";

export type TrafficReportMetricRow = {
  campaign_id: string;
  spend: number | string | null;
  leads: number | null;
  impressions: number | null;
  reach: number | null;
  clicks: number | null;
  link_clicks?: number | null;
  conversions: number | null;
  unique_ctr?: number | null;
};

export type TrafficReportCampaignRow = {
  id: string;
  name: string;
  status: string;
  thumbnail_url?: string | null;
};

const number = (value: unknown) => Number(value) || 0;
const clickCount = (metric: TrafficReportMetricRow) => number(metric.link_clicks) > 0 ? number(metric.link_clicks) : number(metric.clicks);

export function aggregateTrafficReport(params: {
  clientName: string;
  accountName?: string | null;
  since: string;
  until: string;
  generatedAt?: string;
  campaigns: TrafficReportCampaignRow[];
  metrics: TrafficReportMetricRow[];
}): TrafficReportData {
  const campaignsById = new Map(params.campaigns.map((campaign) => [campaign.id, campaign]));
  const spend = params.metrics.reduce((sum, metric) => sum + number(metric.spend), 0);
  const leads = params.metrics.reduce((sum, metric) => sum + number(metric.leads), 0);
  const impressions = params.metrics.reduce((sum, metric) => sum + number(metric.impressions), 0);
  const reach = params.metrics.reduce((sum, metric) => sum + number(metric.reach), 0);
  const clicks = params.metrics.reduce((sum, metric) => sum + clickCount(metric), 0);
  const conversions = params.metrics.reduce((sum, metric) => sum + number(metric.conversions), 0);
  const hasUniqueCtr = params.metrics.some((metric) => number(metric.unique_ctr) > 0);
  const ctr = hasUniqueCtr && impressions > 0
    ? params.metrics.reduce((sum, metric) => sum + number(metric.unique_ctr) * number(metric.impressions), 0) / impressions
    : impressions > 0 ? clicks / impressions * 100 : 0;

  const grouped = new Map<string, TrafficReportMetricRow[]>();
  params.metrics.forEach((metric) => grouped.set(metric.campaign_id, [...(grouped.get(metric.campaign_id) ?? []), metric]));
  const campaignSummaries: TrafficReportCampaign[] = Array.from(grouped.entries()).map(([campaignId, rows]) => {
    const campaign = campaignsById.get(campaignId);
    const campaignSpend = rows.reduce((sum, row) => sum + number(row.spend), 0);
    const campaignLeads = rows.reduce((sum, row) => sum + number(row.leads), 0);
    const campaignImpressions = rows.reduce((sum, row) => sum + number(row.impressions), 0);
    const campaignClicks = rows.reduce((sum, row) => sum + clickCount(row), 0);
    const campaignConversions = rows.reduce((sum, row) => sum + number(row.conversions), 0);
    return {
      id: campaignId,
      name: campaign?.name ?? campaignId,
      status: campaign?.status ?? "desconhecido",
      spend: campaignSpend,
      leads: campaignLeads,
      cpl: campaignLeads > 0 ? campaignSpend / campaignLeads : 0,
      ctr: campaignImpressions > 0 ? campaignClicks / campaignImpressions * 100 : 0,
      impressions: campaignImpressions,
      clicks: campaignClicks,
      conversions: campaignConversions,
      thumbnailDataUrl: campaign?.thumbnail_url ?? null,
    };
  }).sort((a, b) => b.leads - a.leads || (a.cpl || Number.MAX_SAFE_INTEGER) - (b.cpl || Number.MAX_SAFE_INTEGER) || b.ctr - a.ctr);
  const creativeThumbnails = new Set<string>();
  const creatives = campaignSummaries.filter((campaign) => {
    if (!campaign.thumbnailDataUrl || creativeThumbnails.has(campaign.thumbnailDataUrl)) return false;
    creativeThumbnails.add(campaign.thumbnailDataUrl);
    return true;
  }).slice(0, 4);

  return {
    clientName: params.clientName,
    accountName: params.accountName ?? null,
    since: params.since,
    until: params.until,
    generatedAt: params.generatedAt ?? new Date().toISOString(),
    metrics: {
      spend,
      leads,
      cpl: leads > 0 ? spend / leads : 0,
      ctr,
      impressions,
      reach,
      clicks,
      conversions,
      cpc: clicks > 0 ? spend / clicks : 0,
      cpm: impressions > 0 ? spend / impressions * 1000 : 0,
      activeCampaigns: params.campaigns.filter((campaign) => campaign.status === "ativa").length,
    },
    campaigns: campaignSummaries.slice(0, 8),
    creatives,
  };
}

export function trafficReportFilename(clientName: string, since: string, until: string) {
  const client = clientName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/(^-|-$)/g, "").toLowerCase() || "cliente";
  return `relatorio-trafego-pago-${client}-${since}-a-${until}.pdf`;
}
