export interface TrafficReportCampaign {
  id: string;
  name: string;
  status: string;
  spend: number;
  leads: number;
  cpl: number;
  ctr: number;
  impressions: number;
  clicks: number;
  conversions: number;
  thumbnailDataUrl?: string | null;
}

export interface TrafficReportData {
  clientName: string;
  accountName: string | null;
  since: string;
  until: string;
  generatedAt: string;
  metrics: {
    spend: number;
    leads: number;
    cpl: number;
    ctr: number;
    impressions: number;
    reach: number;
    clicks: number;
    conversions: number;
    cpc: number;
    cpm: number;
    activeCampaigns: number;
  };
  campaigns: TrafficReportCampaign[];
  creatives: TrafficReportCampaign[];
}
