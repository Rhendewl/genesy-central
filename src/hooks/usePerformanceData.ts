"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { useCurrentMember } from "@/context/CurrentMemberContext";
import {
  DEFAULT_PERFORMANCE_ROLE_CONFIGS,
  PERFORMANCE_ROLES,
  mapPerformanceRoleConfigRow,
  mergePerformanceRoleConfigs,
  normalizePerformanceWeights,
  type PerformanceRoleConfigRow,
} from "@/lib/performance-config";
import type {
  PerformanceCollaborator,
  PerformanceIndicator,
  PerformancePillars,
  PerformanceRole,
  PerformanceRoleConfig,
  PerformanceTeamData,
  UsePerformanceDataReturn,
} from "@/types/performance";

type UserProfileRow = {
  id: string;
  owner_id: string;
  auth_user_id: string | null;
  full_name: string;
  email: string;
  role: string;
  job_title: string | null;
  avatar_url: string | null;
  is_active: boolean;
};

type WorkspaceTaskRow = {
  id: string;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  updated_at: string | null;
  created_at: string;
};

type TaskAssigneeRow = {
  task_id: string;
  assignee_id: string;
};

type LeadRow = {
  id: string;
  assigned_to: string | null;
  deal_value: number | null;
  iq_score: number | null;
  entered_at: string | null;
  created_at: string;
  updated_at: string;
};

type StageRow = {
  id: string;
  name: string;
  is_won?: boolean | null;
  pipeline_id?: string | null;
};

type StageHistoryRow = {
  lead_id: string;
  stage_id: string | null;
  moved_at: string;
};

type CampaignMetricRow = {
  date: string;
  spend: number | string;
  leads: number;
  conversions: number;
};

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function pct(value: number, target: number) {
  if (target <= 0) return 0;
  return clampScore((value / target) * 100);
}

function monthBounds(base = new Date()) {
  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  const next = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  const prevStart = new Date(base.getFullYear(), base.getMonth() - 1, 1);
  return {
    startKey: start.toISOString().slice(0, 10),
    nextKey: next.toISOString().slice(0, 10),
    prevStartKey: prevStart.toISOString().slice(0, 10),
    label: start.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
  };
}

function normalizeRole(profile: UserProfileRow): PerformanceRole {
  const raw = `${profile.job_title ?? ""} ${profile.role ?? ""}`.toLowerCase();
  if (raw.includes("closer") || raw.includes("vendedor")) return "closer";
  if (raw.includes("bdr")) return "bdr";
  if (raw.includes("designer") || raw.includes("design")) return "designer";
  if (raw.includes("tráfego") || raw.includes("trafego") || raw.includes("traffic")) return "gestor_trafego";
  return "sdr";
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function scoreFromPillars(pillars: PerformancePillars, weights: PerformancePillars) {
  const normalized = normalizePerformanceWeights(weights);
  const total = normalized.resultado + normalized.produtividade + normalized.organizacao + normalized.disciplina;
  if (total <= 0) return average(Object.values(pillars));
  return clampScore(
    (pillars.resultado * normalized.resultado +
      pillars.produtividade * normalized.produtividade +
      pillars.organizacao * normalized.organizacao +
      pillars.disciplina * normalized.disciplina) / total
  );
}

function safeDateKey(date: string | null) {
  return date ? date.slice(0, 10) : "";
}

export function usePerformanceData(): UsePerformanceDataReturn {
  const { member, isOwner, isLoading: memberLoading } = useCurrentMember();
  const [team, setTeam] = useState<PerformanceTeamData | null>(null);
  const [collaborators, setCollaborators] = useState<PerformanceCollaborator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (memberLoading) return;

    try {
      setIsLoading(true);
      setError(null);

      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCollaborators([]);
        setTeam(null);
        return;
      }

      const ownerId = member?.owner_id ?? user.id;
      const { startKey, nextKey, prevStartKey, label } = monthBounds();
      const todayKey = new Date().toISOString().slice(0, 10);
      const canViewTeam = isOwner === true || member?.role === "admin";

      const [
        profilesRes,
        tasksRes,
        assigneesRes,
        leadsRes,
        stagesRes,
        historyRes,
        metricsRes,
        configsRes,
      ] = await Promise.all([
        supabase
          .from("user_profiles")
          .select("id, owner_id, auth_user_id, full_name, email, role, job_title, avatar_url, is_active")
          .eq("owner_id", ownerId)
          .eq("is_active", true),
        supabase
          .from("workspace_tasks")
          .select("id, status, due_date, completed_at, updated_at, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("workspace_task_assignees")
          .select("task_id, assignee_id"),
        supabase
          .from("leads")
          .select("id, assigned_to, deal_value, iq_score, entered_at, created_at, updated_at")
          .gte("created_at", prevStartKey)
          .lt("created_at", nextKey),
        supabase
          .from("crm_stages")
          .select("id, name, is_won, pipeline_id"),
        supabase
          .from("crm_lead_stage_history")
          .select("lead_id, stage_id, moved_at")
          .gte("moved_at", prevStartKey)
          .lt("moved_at", nextKey),
        supabase
          .from("campaign_metrics")
          .select("date, spend, leads, conversions")
          .gte("date", prevStartKey)
          .lt("date", nextKey),
        supabase
          .from("performance_role_configs")
          .select("id, role_key, role_label, main_goal_type, main_goal_label, main_goal_target, weight_resultado, weight_produtividade, weight_organizacao, weight_disciplina, crm_pipeline_id, meeting_stage_ids, sales_stage_ids, is_active")
          .eq("user_id", ownerId),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (configsRes.error && configsRes.error.code !== "42P01") throw configsRes.error;

      const profiles = ((profilesRes.data ?? []) as UserProfileRow[])
        .filter((profile) => canViewTeam || profile.id === member?.id);
      const tasks = (tasksRes.data ?? []) as WorkspaceTaskRow[];
      const assignees = (assigneesRes.data ?? []) as TaskAssigneeRow[];
      const leads = (leadsRes.data ?? []) as LeadRow[];
      const stages = (stagesRes.data ?? []) as StageRow[];
      const history = (historyRes.data ?? []) as StageHistoryRow[];
      const metrics = (metricsRes.data ?? []) as CampaignMetricRow[];
      const roleConfigs = mergePerformanceRoleConfigs(
        (((configsRes.error ? [] : configsRes.data) ?? []) as unknown as PerformanceRoleConfigRow[]).map(mapPerformanceRoleConfigRow)
      );

      const taskById = new Map(tasks.map((task) => [task.id, task]));
      const stagesById = new Map(stages.map((stage) => [stage.id, stage]));
      const leadById = new Map(leads.map((lead) => [lead.id, lead]));
      const trafficCurrent = metrics.filter((row) => safeDateKey(row.date) >= startKey);
      const trafficLeads = trafficCurrent.reduce((sum, row) => sum + Number(row.leads ?? 0), 0);
      const trafficConversions = trafficCurrent.reduce((sum, row) => sum + Number(row.conversions ?? 0), 0);
      const trafficSpend = trafficCurrent.reduce((sum, row) => sum + Number(row.spend ?? 0), 0);
      const trafficCpl = trafficLeads > 0 ? trafficSpend / trafficLeads : 0;
      const trafficLeadIq = leads
        .filter((lead) => safeDateKey(lead.created_at) >= startKey && lead.iq_score != null)
        .map((lead) => Number(lead.iq_score));
      const trafficIqAverage = trafficLeadIq.length > 0 ? average(trafficLeadIq) : 0;

      const profileTasks = (profileId: string, currentMonth: boolean) => {
        return assignees
          .filter((row) => row.assignee_id === profileId)
          .map((row) => taskById.get(row.task_id))
          .filter((task): task is WorkspaceTaskRow => Boolean(task))
          .filter((task) => {
            const key = safeDateKey(task.completed_at ?? task.created_at);
            return currentMonth ? key >= startKey : key < startKey;
          });
      };

      const profileAssignedTasks = (profileId: string) => {
        return assignees
          .filter((row) => row.assignee_id === profileId)
          .map((row) => taskById.get(row.task_id))
          .filter((task): task is WorkspaceTaskRow => Boolean(task));
      };

      const profileLeads = (profileId: string, currentMonth: boolean) => {
        return leads.filter((lead) => {
          const key = safeDateKey(lead.created_at);
          return lead.assigned_to === profileId && (currentMonth ? key >= startKey : key < startKey);
        });
      };

      const stageBelongsToConfigPipeline = (stage: StageRow | undefined, config: PerformanceRoleConfig) => {
        return !config.crmPipelineId || stage?.pipeline_id === config.crmPipelineId;
      };

      const matchesMeetingStage = (stage: StageRow | undefined, config: PerformanceRoleConfig) => {
        if (!stage || !stageBelongsToConfigPipeline(stage, config)) return false;
        if (config.meetingStageIds.length > 0) return config.meetingStageIds.includes(stage.id);
        const name = stage.name.toLowerCase();
        return name.includes("reunião agendada") || name.includes("reuniao agendada");
      };

      const matchesSaleStage = (stage: StageRow | undefined, config: PerformanceRoleConfig) => {
        if (!stage || !stageBelongsToConfigPipeline(stage, config)) return false;
        if (config.salesStageIds.length > 0) return config.salesStageIds.includes(stage.id);
        return Boolean(stage.is_won || stage.name.toLowerCase().includes("venda"));
      };

      const profileStageEntries = (profileId: string, matcher: (stage: StageRow | undefined) => boolean, currentMonth: boolean) => {
        return history.filter((entry) => {
          const key = safeDateKey(entry.moved_at);
          const lead = leadById.get(entry.lead_id);
          return lead?.assigned_to === profileId && matcher(stagesById.get(entry.stage_id ?? "")) && (currentMonth ? key >= startKey : key < startKey);
        });
      };

      const buildCollaborator = (profile: UserProfileRow): PerformanceCollaborator | null => {
        const role = normalizeRole(profile);
        const config = roleConfigs[role] ?? DEFAULT_PERFORMANCE_ROLE_CONFIGS[role];
        if (!config.isActive) return null;
        const currentTasks = profileTasks(profile.id, true);
        const previousTasks = profileTasks(profile.id, false);
        const assignedTasks = profileAssignedTasks(profile.id);
        const currentLeads = profileLeads(profile.id, true);
        const previousLeads = profileLeads(profile.id, false);
        const completedTasks = currentTasks.filter((task) => task.status === "concluido");
        const previousCompletedTasks = previousTasks.filter((task) => task.status === "concluido");
        const overdueTasks = assignedTasks.filter((task) => task.status !== "concluido" && task.due_date && task.due_date < todayKey);
        const onTimeTasks = completedTasks.filter((task) => !task.due_date || safeDateKey(task.completed_at) <= task.due_date);
        const meetings = profileStageEntries(
          profile.id,
          (stage) => matchesMeetingStage(stage, config),
          true
        );
        const previousMeetings = profileStageEntries(
          profile.id,
          (stage) => matchesMeetingStage(stage, config),
          false
        );
        const sales = profileStageEntries(
          profile.id,
          (stage) => matchesSaleStage(stage, config),
          true
        );
        const previousSales = profileStageEntries(
          profile.id,
          (stage) => matchesSaleStage(stage, config),
          false
        );
        const salesLeadIds = new Set(sales.map((entry) => entry.lead_id));
        const revenue = currentLeads
          .filter((lead) => salesLeadIds.has(lead.id))
          .reduce((sum, lead) => sum + Number(lead.deal_value ?? 0), 0);
        const iqValues = currentLeads.map((lead) => lead.iq_score).filter((value): value is number => value != null);
        const averageIq = iqValues.length ? average(iqValues.map(Number)) : 0;

        const resolveGoalValue = (currentMonth: boolean) => {
          switch (config.mainGoalType) {
            case "crm_won_count":
              return currentMonth ? sales.length : previousSales.length;
            case "workspace_completed_tasks":
              return currentMonth ? completedTasks.length : previousCompletedTasks.length;
            case "traffic_iq_average":
              return trafficIqAverage;
            case "traffic_leads":
              return trafficLeads;
            case "traffic_conversions":
              return trafficConversions;
            case "crm_stage_count":
            default:
              return currentMonth ? meetings.length : previousMeetings.length;
          }
        };

        const mainGoalValue = resolveGoalValue(true);
        const previousMainGoalValue = resolveGoalValue(false);

        const resultScore = pct(mainGoalValue, config.mainGoalTarget);
        const previousResultScore = pct(previousMainGoalValue, config.mainGoalTarget);
        const productivityScore = currentTasks.length
          ? clampScore((completedTasks.length / currentTasks.length) * 70 + (onTimeTasks.length / Math.max(completedTasks.length, 1)) * 30)
          : 55;
        const previousProductivityScore = previousTasks.length
          ? clampScore((previousCompletedTasks.length / previousTasks.length) * 100)
          : 55;
        const organizationScore = clampScore(
          50 +
          Math.min(currentTasks.length, 20) * 1.5 +
          Math.min(currentLeads.length, 30) * 0.8 -
          overdueTasks.length * 6
        );
        const disciplineScore = clampScore(100 - overdueTasks.length * 12);
        const pillars = {
          resultado: resultScore,
          produtividade: productivityScore,
          organizacao: organizationScore,
          disciplina: disciplineScore,
        };
        const previousScore = scoreFromPillars({
          resultado: previousResultScore,
          produtividade: previousProductivityScore,
          organizacao: organizationScore,
          disciplina: disciplineScore,
        }, config.weights);

        const indicators: PerformanceIndicator[] = [
          { label: "Tarefas concluídas", value: String(completedTasks.length), hint: "Workspace no mês", tone: "green" },
          { label: "Tarefas atrasadas", value: String(overdueTasks.length), hint: "Disciplina operacional", tone: overdueTasks.length ? "red" : "green" },
          { label: "Leads atendidos", value: String(currentLeads.length), hint: "CRM atribuídos ao colaborador", tone: "blue" },
          { label: "IQ médio", value: averageIq ? String(averageIq) : "N/D", hint: "Qualificação média dos leads", tone: "violet" },
        ];

        if (role === "closer") {
          indicators.push(
            { label: "Receita gerada", value: revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }), hint: "Leads em etapa de venda", tone: "green" },
            { label: "Taxa de fechamento", value: `${pct(sales.length, Math.max(meetings.length, 1))}%`, hint: "Reuniões para venda", tone: "blue" }
          );
        }

        if (role === "gestor_trafego") {
          indicators.push(
            { label: "Volume de leads", value: String(trafficLeads), hint: "Campanhas do mês", tone: "blue" },
            { label: "CPL", value: trafficCpl ? trafficCpl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "N/D", hint: "Custo por lead", tone: "amber" },
            { label: "Conversões", value: String(trafficConversions), hint: "Métricas de campanha", tone: "green" }
          );
        }

        const score = scoreFromPillars(pillars, config.weights);
        return {
          id: profile.id,
          name: profile.full_name,
          email: profile.email,
          avatarUrl: profile.avatar_url,
          role,
          roleLabel: config.roleLabel,
          jobTitle: profile.job_title || config.roleLabel,
          score,
          previousScore,
          pillars,
          pillarWeights: config.weights,
          mainGoalLabel: config.mainGoalLabel,
          mainGoalValue,
          mainGoalTarget: config.mainGoalTarget,
          goalsHit: mainGoalValue >= config.mainGoalTarget ? 1 : 0,
          indicators,
          history: [
            { month: "Mês anterior", score: previousScore },
            { month: label, score },
          ],
          summary: score >= 80
            ? "Performance forte, com boa consistência operacional."
            : score >= 60
              ? "Performance saudável, com pontos claros para evolução."
              : "Precisa de atenção para recuperar ritmo e disciplina.",
          needsAttention: score < 60 || overdueTasks.length >= 3,
        };
      };

      const nextCollaborators = profiles
        .map(buildCollaborator)
        .filter((item): item is PerformanceCollaborator => Boolean(item))
        .sort((a, b) => b.score - a.score);
      const averageScore = average(nextCollaborators.map((item) => item.score));
      const previousAverageScore = average(nextCollaborators.map((item) => item.previousScore));
      const byRole = PERFORMANCE_ROLES.map((role) => roleConfigs[role]?.roleLabel ?? DEFAULT_PERFORMANCE_ROLE_CONFIGS[role].roleLabel)
        .map((roleLabel) => {
          const members = nextCollaborators.filter((item) => item.roleLabel === roleLabel);
          return { role: roleLabel, average: average(members.map((item) => item.score)), count: members.length };
        })
        .filter((item) => item.count > 0);

      setCollaborators(nextCollaborators);
      setTeam({
        averageScore,
        previousAverageScore,
        goalsHit: nextCollaborators.reduce((sum, item) => sum + item.goalsHit, 0),
        ranking: nextCollaborators,
        best: nextCollaborators.slice(0, 3),
        attention: nextCollaborators.filter((item) => item.needsAttention).slice(0, 4),
        byRole,
        evolution: [
          { month: "Mês anterior", score: previousAverageScore },
          { month: label, score: averageScore },
        ],
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar performance");
    } finally {
      setIsLoading(false);
    }
  }, [isOwner, member?.id, member?.owner_id, member?.role, memberLoading]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return { team, collaborators, isLoading, error, refetch: fetchData };
}
