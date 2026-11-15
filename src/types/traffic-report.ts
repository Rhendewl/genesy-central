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
}

export interface TrafficReportData {
  clientName: string;
  accountName: string | null;
  since: string;
  until: string;
  generatedAt: string;
  metrics: {
    messaging_history_pending?: boolean;
    messaging_results?: import("@/lib/messaging-results").MessagingResults;
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
}
