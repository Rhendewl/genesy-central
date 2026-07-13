import type {
  PerformanceMainGoalType,
  PerformancePillars,
  PerformanceRole,
  PerformanceRoleConfig,
} from "@/types/performance";

export const PERFORMANCE_ROLES: PerformanceRole[] = ["gestor_trafego", "sdr", "closer", "bdr", "designer"];

export const PERFORMANCE_GOAL_OPTIONS: Array<{ value: PerformanceMainGoalType; label: string }> = [
  { value: "crm_stage_count", label: "Contagem de etapas do CRM" },
  { value: "crm_won_count", label: "Vendas no CRM" },
  { value: "workspace_completed_tasks", label: "Tarefas concluídas" },
  { value: "traffic_iq_average", label: "IQ médio dos leads" },
  { value: "traffic_leads", label: "Leads de tráfego" },
  { value: "traffic_conversions", label: "Conversões de tráfego" },
];

export const DEFAULT_PERFORMANCE_ROLE_CONFIGS: Record<PerformanceRole, PerformanceRoleConfig> = {
  gestor_trafego: {
    roleKey: "gestor_trafego",
    roleLabel: "Gestor de Tráfego",
    mainGoalType: "traffic_iq_average",
    mainGoalLabel: "IQ médio dos leads",
    mainGoalTarget: 80,
    weights: { resultado: 50, produtividade: 20, organizacao: 15, disciplina: 15 },
    crmPipelineId: null,
    meetingStageIds: [],
    salesStageIds: [],
    isActive: true,
  },
  sdr: {
    roleKey: "sdr",
    roleLabel: "SDR",
    mainGoalType: "crm_stage_count",
    mainGoalLabel: "Reuniões agendadas",
    mainGoalTarget: 25,
    weights: { resultado: 50, produtividade: 20, organizacao: 15, disciplina: 15 },
    crmPipelineId: null,
    meetingStageIds: [],
    salesStageIds: [],
    isActive: true,
  },
  closer: {
    roleKey: "closer",
    roleLabel: "Closer",
    mainGoalType: "crm_won_count",
    mainGoalLabel: "Vendas",
    mainGoalTarget: 8,
    weights: { resultado: 50, produtividade: 20, organizacao: 15, disciplina: 15 },
    crmPipelineId: null,
    meetingStageIds: [],
    salesStageIds: [],
    isActive: true,
  },
  bdr: {
    roleKey: "bdr",
    roleLabel: "BDR",
    mainGoalType: "crm_stage_count",
    mainGoalLabel: "Reuniões agendadas",
    mainGoalTarget: 20,
    weights: { resultado: 50, produtividade: 20, organizacao: 15, disciplina: 15 },
    crmPipelineId: null,
    meetingStageIds: [],
    salesStageIds: [],
    isActive: true,
  },
  designer: {
    roleKey: "designer",
    roleLabel: "Designer",
    mainGoalType: "workspace_completed_tasks",
    mainGoalLabel: "Demandas concluídas",
    mainGoalTarget: 30,
    weights: { resultado: 50, produtividade: 20, organizacao: 15, disciplina: 15 },
    crmPipelineId: null,
    meetingStageIds: [],
    salesStageIds: [],
    isActive: true,
  },
};

export type PerformanceRoleConfigRow = {
  id: string;
  role_key: PerformanceRole;
  role_label: string;
  main_goal_type: PerformanceMainGoalType;
  main_goal_label: string;
  main_goal_target: number | string;
  weight_resultado: number | string;
  weight_produtividade: number | string;
  weight_organizacao: number | string;
  weight_disciplina: number | string;
  crm_pipeline_id: string | null;
  meeting_stage_ids: string[] | null;
  sales_stage_ids: string[] | null;
  is_active: boolean;
};

function numberOrFallback(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizePerformanceWeights(weights: PerformancePillars): PerformancePillars {
  return {
    resultado: Math.max(0, numberOrFallback(weights.resultado, 0)),
    produtividade: Math.max(0, numberOrFallback(weights.produtividade, 0)),
    organizacao: Math.max(0, numberOrFallback(weights.organizacao, 0)),
    disciplina: Math.max(0, numberOrFallback(weights.disciplina, 0)),
  };
}

export function mapPerformanceRoleConfigRow(row: PerformanceRoleConfigRow): PerformanceRoleConfig {
  const fallback = DEFAULT_PERFORMANCE_ROLE_CONFIGS[row.role_key];
  return {
    id: row.id,
    roleKey: row.role_key,
    roleLabel: row.role_label || fallback.roleLabel,
    mainGoalType: row.main_goal_type || fallback.mainGoalType,
    mainGoalLabel: row.main_goal_label || fallback.mainGoalLabel,
    mainGoalTarget: numberOrFallback(row.main_goal_target, fallback.mainGoalTarget),
    weights: normalizePerformanceWeights({
      resultado: numberOrFallback(row.weight_resultado, fallback.weights.resultado),
      produtividade: numberOrFallback(row.weight_produtividade, fallback.weights.produtividade),
      organizacao: numberOrFallback(row.weight_organizacao, fallback.weights.organizacao),
      disciplina: numberOrFallback(row.weight_disciplina, fallback.weights.disciplina),
    }),
    crmPipelineId: row.crm_pipeline_id,
    meetingStageIds: row.meeting_stage_ids ?? [],
    salesStageIds: row.sales_stage_ids ?? [],
    isActive: row.is_active,
  };
}

export function mergePerformanceRoleConfigs(rows: PerformanceRoleConfig[] = []) {
  const merged = { ...DEFAULT_PERFORMANCE_ROLE_CONFIGS };
  for (const row of rows) {
    merged[row.roleKey] = {
      ...merged[row.roleKey],
      ...row,
      weights: normalizePerformanceWeights(row.weights),
      meetingStageIds: row.meetingStageIds ?? [],
      salesStageIds: row.salesStageIds ?? [],
    };
  }
  return merged;
}

