export type CommercialProductType =
  | "residential_low"
  | "residential_mid"
  | "residential_high"
  | "studios_flats"
  | "land_development"
  | "commercial";

export const COMMERCIAL_PRODUCT_LABELS: Record<CommercialProductType, string> = {
  residential_low: "Residencial de baixo padrão",
  residential_mid: "Residencial de médio padrão",
  residential_high: "Residencial de alto padrão",
  studios_flats: "Studios / Flats",
  land_development: "Loteamento",
  commercial: "Comercial",
};

export interface CommercialAnalysisMetrics {
  contactRate: number;
  responseRate: number;
  noResponseRate: number;
  qualificationRate: number;
  schedulingRate: number;
  attendanceRate: number;
  qualifiedMeetingRate: number;
  proposalRate: number;
  closingRate: number;
  overallConversionRate: number;
  averageTicket: number;
  revenuePerLead: number;
}

export interface CommercialAnalysisInsight {
  id: string;
  status: "good" | "attention" | "critical" | "info";
  title: string;
  signal: string;
  diagnosis: string;
  action: string;
}

export interface CommercialAnalysisSnapshot {
  score: number;
  status: "healthy" | "attention" | "critical";
  executiveSummary: string;
  metrics: CommercialAnalysisMetrics;
  insights: CommercialAnalysisInsight[];
}

export interface CommercialAnalysisInput {
  client_id: string;
  meeting_date: string;
  period_start: string;
  period_end: string;
  participants: string | null;
  leads_received: number;
  leads_contacted: number;
  leads_responded: number;
  leads_no_response: number;
  qualified_leads: number;
  disqualified_leads: number;
  hot_leads: number;
  warm_leads: number;
  cold_leads: number;
  product_type: CommercialProductType;
  development_name: string | null;
  meetings_scheduled: number;
  meetings_held: number;
  no_shows: number;
  rescheduled_meetings: number;
  qualified_meetings: number;
  proposals_sent: number;
  sales_closed: number;
  revenue: number;
  lost_sales: number;
  response_notes: string | null;
  lead_profile_notes: string | null;
  meeting_notes: string | null;
  loss_reasons: string | null;
  wins: string | null;
  blockers: string | null;
  decisions: string | null;
  next_actions: string | null;
}

export interface CommercialAnalysis extends CommercialAnalysisInput {
  id: string;
  user_id: string;
  created_by: string | null;
  analysis_snapshot: CommercialAnalysisSnapshot;
  created_at: string;
  updated_at: string;
}
