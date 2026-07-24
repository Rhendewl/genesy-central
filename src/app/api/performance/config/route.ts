import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  DEFAULT_PERFORMANCE_ROLE_CONFIGS,
  PERFORMANCE_GOAL_OPTIONS,
  PERFORMANCE_ROLES,
  mapPerformanceRoleConfigRow,
  mergePerformanceRoleConfigs,
  normalizePerformanceWeights,
  type PerformanceRoleConfigRow,
} from "@/lib/performance-config";
import type { PerformanceMainGoalType, PerformanceRoleConfig } from "@/types/performance";

type CurrentProfile = {
  id: string;
  owner_id: string;
  auth_user_id: string | null;
  role: string;
};

type SavePayload = {
  configs?: Array<Partial<PerformanceRoleConfig>>;
  gamificationProfileIds?: string[];
};

const CONFIG_SELECT = [
  "id",
  "role_key",
  "role_label",
  "main_goal_type",
  "main_goal_label",
  "main_goal_target",
  "weight_resultado",
  "weight_produtividade",
  "weight_organizacao",
  "weight_disciplina",
  "crm_pipeline_id",
  "meeting_stage_ids",
  "sales_stage_ids",
  "job_title_aliases",
  "member_profile_ids",
  "is_active",
].join(", ");

const LEGACY_CONFIG_SELECT = [
  "id",
  "role_key",
  "role_label",
  "main_goal_type",
  "main_goal_label",
  "main_goal_target",
  "weight_resultado",
  "weight_produtividade",
  "weight_organizacao",
  "weight_disciplina",
  "crm_pipeline_id",
  "meeting_stage_ids",
  "sales_stage_ids",
  "is_active",
].join(", ");

async function getSessionContext() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null, ownerId: null, canManage: false };

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id, owner_id, auth_user_id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const currentProfile = profile as CurrentProfile | null;
  const ownerId = currentProfile?.owner_id ?? user.id;
  const canManage = ownerId === user.id || currentProfile?.role === "admin";
  return { supabase, user, profile: currentProfile, ownerId, canManage };
}

function isMissingConfigTable(error: { code?: string; message?: string } | null) {
  return error?.code === "42P01" || Boolean(error?.message?.includes("performance_role_configs"));
}

function isMissingGroupColumns(error: { message?: string } | null) {
  return Boolean(error?.message?.includes("job_title_aliases") || error?.message?.includes("member_profile_ids"));
}

function isMissingGamificationTable(error: { code?: string; message?: string } | null) {
  return error?.code === "42P01"
    || Boolean(error?.message?.includes("performance_gamification_settings"));
}

async function loadGamificationSettings(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  ownerId: string,
) {
  const { data, error } = await supabase
    .from("performance_gamification_settings")
    .select("participant_profile_ids")
    .eq("user_id", ownerId)
    .maybeSingle();

  if (error) {
    if (isMissingGamificationTable(error)) {
      return { gamificationProfileIds: null, gamificationTableReady: false };
    }
    throw error;
  }

  return {
    gamificationProfileIds: data
      ? ((data.participant_profile_ids ?? []) as string[])
      : null,
    gamificationTableReady: true,
  };
}

async function loadConfigs(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, ownerId: string) {
  let { data, error } = await supabase
    .from("performance_role_configs")
    .select(CONFIG_SELECT)
    .eq("user_id", ownerId)
    .order("role_key", { ascending: true });

  if (error) {
    if (isMissingConfigTable(error)) {
      return {
        configs: Object.values(DEFAULT_PERFORMANCE_ROLE_CONFIGS),
        tableReady: false,
      };
    }
    if (isMissingGroupColumns(error)) {
      const legacy = await supabase
        .from("performance_role_configs")
        .select(LEGACY_CONFIG_SELECT)
        .eq("user_id", ownerId)
        .order("role_key", { ascending: true });
      data = legacy.data;
      error = legacy.error;
      if (error) throw error;
    } else {
      throw error;
    }
  }

  const mapped = ((data ?? []) as unknown as PerformanceRoleConfigRow[]).map(mapPerformanceRoleConfigRow);
  return {
    configs: Object.values(mergePerformanceRoleConfigs(mapped)),
    tableReady: true,
  };
}

function sanitizeConfig(input: Partial<PerformanceRoleConfig>) {
  const roleKey = input.roleKey;
  if (!roleKey || !PERFORMANCE_ROLES.includes(roleKey)) return null;

  const fallback = DEFAULT_PERFORMANCE_ROLE_CONFIGS[roleKey];
  const goalType = PERFORMANCE_GOAL_OPTIONS.some((option) => option.value === input.mainGoalType)
    ? input.mainGoalType as PerformanceMainGoalType
    : fallback.mainGoalType;
  const weights = normalizePerformanceWeights(input.weights ?? fallback.weights);

  return {
    roleKey,
    roleLabel: typeof input.roleLabel === "string" && input.roleLabel.trim() ? input.roleLabel.trim() : fallback.roleLabel,
    mainGoalType: goalType,
    mainGoalLabel: typeof input.mainGoalLabel === "string" && input.mainGoalLabel.trim() ? input.mainGoalLabel.trim() : fallback.mainGoalLabel,
    mainGoalTarget: Math.max(0, Number(input.mainGoalTarget ?? fallback.mainGoalTarget) || fallback.mainGoalTarget),
    weights,
    crmPipelineId: input.crmPipelineId || null,
    meetingStageIds: Array.isArray(input.meetingStageIds) ? input.meetingStageIds.filter(Boolean) : [],
    salesStageIds: Array.isArray(input.salesStageIds) ? input.salesStageIds.filter(Boolean) : [],
    jobTitleAliases: Array.isArray(input.jobTitleAliases)
      ? input.jobTitleAliases.map((item) => String(item).trim()).filter(Boolean)
      : fallback.jobTitleAliases,
    memberProfileIds: Array.isArray(input.memberProfileIds)
      ? input.memberProfileIds.filter(Boolean)
      : [],
    isActive: input.isActive !== false,
  };
}

export async function GET() {
  try {
    const { supabase, user, ownerId } = await getSessionContext();
    if (!user || !ownerId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const [{ configs, tableReady }, gamification, pipelinesRes, profilesRes] = await Promise.all([
      loadConfigs(supabase, ownerId),
      loadGamificationSettings(supabase, ownerId),
      supabase
        .from("crm_pipelines")
        .select("id, name, is_active, crm_stages(id, name, pipeline_id, is_won, is_active, order_index)")
        .order("order_index", { ascending: true })
        .order("order_index", { foreignTable: "crm_stages", ascending: true }),
      supabase
        .from("user_profiles")
        .select("id, full_name, email, role, job_title, avatar_url, is_active")
        .eq("owner_id", ownerId)
        .eq("is_active", true)
        .order("full_name", { ascending: true }),
    ]);

    if (pipelinesRes.error) throw pipelinesRes.error;
    if (profilesRes.error) throw profilesRes.error;

    return NextResponse.json({
      configs,
      pipelines: pipelinesRes.data ?? [],
      profiles: profilesRes.data ?? [],
      tableReady,
      ...gamification,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao carregar configurações de performance";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { supabase, user, ownerId, canManage } = await getSessionContext();
    if (!user || !ownerId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    if (!canManage) return NextResponse.json({ error: "Apenas administradores podem alterar Performance" }, { status: 403 });

    const body = await req.json().catch(() => null) as SavePayload | null;
    const nextConfigs = (body?.configs ?? []).map(sanitizeConfig).filter(Boolean);
    if (nextConfigs.length === 0) {
      return NextResponse.json({ error: "Nenhuma configuração válida enviada" }, { status: 400 });
    }

    const gamification = await loadGamificationSettings(supabase, ownerId);
    if (Array.isArray(body?.gamificationProfileIds) && !gamification.gamificationTableReady) {
      return NextResponse.json({
        error: "Aplique a migration 20260761 para salvar os participantes da gamificação.",
      }, { status: 409 });
    }

    let savedGamificationProfileIds = gamification.gamificationProfileIds;
    if (Array.isArray(body?.gamificationProfileIds)) {
      if (body.gamificationProfileIds.length > 0) {
        const { data: validProfiles, error: profilesError } = await supabase
          .from("user_profiles")
          .select("id")
          .eq("owner_id", ownerId)
          .eq("is_active", true)
          .in("id", body.gamificationProfileIds);
        if (profilesError) throw profilesError;
        savedGamificationProfileIds = (validProfiles ?? []).map((profile) => profile.id);
      } else {
        savedGamificationProfileIds = [];
      }

      const { error: gamificationError } = await supabase
        .from("performance_gamification_settings")
        .upsert({
          user_id: ownerId,
          participant_profile_ids: savedGamificationProfileIds,
        }, { onConflict: "user_id" });
      if (gamificationError) throw gamificationError;
    }

    const rows = nextConfigs.map((config) => ({
      user_id: ownerId,
      role_key: config!.roleKey,
      role_label: config!.roleLabel,
      main_goal_type: config!.mainGoalType,
      main_goal_label: config!.mainGoalLabel,
      main_goal_target: config!.mainGoalTarget,
      weight_resultado: config!.weights.resultado,
      weight_produtividade: config!.weights.produtividade,
      weight_organizacao: config!.weights.organizacao,
      weight_disciplina: config!.weights.disciplina,
      crm_pipeline_id: config!.crmPipelineId,
      meeting_stage_ids: config!.meetingStageIds,
      sales_stage_ids: config!.salesStageIds,
      job_title_aliases: config!.jobTitleAliases,
      member_profile_ids: config!.memberProfileIds,
      is_active: config!.isActive,
    }));

    const { error } = await supabase
      .from("performance_role_configs")
      .upsert(rows, { onConflict: "user_id,role_key" });

    if (error) throw error;

    const { configs, tableReady } = await loadConfigs(supabase, ownerId);
    return NextResponse.json({
      configs,
      tableReady,
      gamificationProfileIds: savedGamificationProfileIds,
      gamificationTableReady: gamification.gamificationTableReady,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao salvar configurações de performance";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
