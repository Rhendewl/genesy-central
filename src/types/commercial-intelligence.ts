import type { FormStep } from "@/types";

export type CommercialFrequency = "weekly" | "biweekly" | "monthly";

export interface CommercialIntelligenceSettings {
  id: string;
  client_id: string;
  frequency: CommercialFrequency;
  meta_account_ids: string[];
  parser_pattern: string;
  parser_group: number;
  public_slug: string | null;
  is_active: boolean;
}

export interface CommercialBroker {
  id: string;
  client_id: string;
  name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
}

export interface CommercialTemplate {
  id: string;
  name: string;
  description: string | null;
  week_number: number | null;
  questions: FormStep[];
  is_system: boolean;
}

export interface CommercialDevelopment {
  name: string;
  campaignIds: string[];
  campaignNames: string[];
  spend: number;
  leads: number;
  impressions: number;
  clicks: number;
}

export interface CommercialCollection {
  id: string;
  client_id: string;
  template_id: string | null;
  name: string;
  slug: string;
  period_start: string;
  period_end: string;
  status: "draft" | "published" | "closed" | "archived";
  developments: CommercialDevelopment[];
  meta_snapshot: Record<string, unknown>;
  ai_diagnosis: CommercialDiagnosis | null;
  response_count?: number;
  expected_responses?: number;
  created_at: string;
}

export interface CommercialResponse {
  id: string;
  collection_id: string;
  broker_id: string;
  development_name: string;
  answers: Record<string, unknown>;
  score: number | null;
  objection: string | null;
  completed_at: string;
}

export interface CommercialDiagnosis {
  generatedAt: string;
  executiveSummary: string;
  recommendations: string[];
  highlights: string[];
  risks: string[];
}

export interface CommercialDashboard {
  responseRate: number;
  totalResponses: number;
  expectedResponses: number;
  byBroker: Array<{ id: string; name: string; responses: number; expected: number }>;
  byDevelopment: Array<{ name: string; responses: number; averageScore: number; leads: number; spend: number }>;
  weeklyEvolution: Array<{ label: string; responses: number; averageScore: number }>;
  objections: Array<{ label: string; count: number }>;
}
