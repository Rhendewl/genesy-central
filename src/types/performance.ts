export type PerformanceRole = "gestor_trafego" | "sdr" | "closer" | "bdr" | "designer";

export type PerformanceMainGoalType =
  | "crm_stage_count"
  | "crm_won_count"
  | "workspace_completed_tasks"
  | "traffic_iq_average"
  | "traffic_leads"
  | "traffic_conversions";

export interface PerformancePillars {
  resultado: number;
  produtividade: number;
  organizacao: number;
  disciplina: number;
}

export interface PerformanceRoleConfig {
  id?: string | null;
  roleKey: PerformanceRole;
  roleLabel: string;
  mainGoalType: PerformanceMainGoalType;
  mainGoalLabel: string;
  mainGoalTarget: number;
  weights: PerformancePillars;
  crmPipelineId: string | null;
  meetingStageIds: string[];
  salesStageIds: string[];
  isActive: boolean;
}

export interface PerformanceIndicator {
  label: string;
  value: string;
  hint: string;
  tone: "blue" | "green" | "amber" | "red" | "violet";
}

export interface PerformanceCollaborator {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: PerformanceRole;
  roleLabel: string;
  jobTitle: string;
  score: number;
  previousScore: number;
  pillars: PerformancePillars;
  pillarWeights: PerformancePillars;
  mainGoalLabel: string;
  mainGoalValue: number;
  mainGoalTarget: number;
  goalsHit: number;
  indicators: PerformanceIndicator[];
  history: Array<{ month: string; score: number }>;
  summary: string;
  needsAttention: boolean;
}

export interface PerformanceTeamData {
  averageScore: number;
  previousAverageScore: number;
  goalsHit: number;
  ranking: PerformanceCollaborator[];
  best: PerformanceCollaborator[];
  attention: PerformanceCollaborator[];
  byRole: Array<{ role: string; average: number; count: number }>;
  evolution: Array<{ month: string; score: number }>;
  updatedAt: string;
}

export interface UsePerformanceDataReturn {
  team: PerformanceTeamData | null;
  collaborators: PerformanceCollaborator[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}
