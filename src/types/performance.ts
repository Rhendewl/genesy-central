export type PerformanceRole = "gestor_trafego" | "sdr" | "closer" | "bdr" | "designer";

export interface PerformancePillars {
  resultado: number;
  produtividade: number;
  organizacao: number;
  disciplina: number;
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
