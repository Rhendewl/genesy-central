import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getPlatformEventBus } from "@/lib/event-bus/platform";
import type { MarketingPriority } from "@/types/marketing";

export interface MarketingServerContext { user: User; profileId: string | null; organizationId: string; isAdmin: boolean; }

export async function getMarketingServerContext(supabase: SupabaseClient): Promise<MarketingServerContext> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw Object.assign(new Error("Não autenticado"), { status: 401 });
  const { data: profile, error } = await supabase.from("user_profiles").select("id,owner_id,role,is_active,permissions").eq("auth_user_id", user.id).maybeSingle();
  if (error) throw new Error(error.message);
  const organizationId = profile?.owner_id ?? user.id;
  const permissions = Array.isArray(profile?.permissions) ? profile.permissions : [];
  const isAdmin = organizationId === user.id || profile?.role === "admin";
  if (profile && (!profile.is_active || (!isAdmin && !permissions.includes("marketing")))) throw Object.assign(new Error("Sem acesso ao módulo Marketing"), { status: 403 });
  return { user, profileId: profile?.id ?? null, organizationId, isAdmin };
}

export function apiError(error: unknown) {
  const status = typeof error === "object" && error && "status" in error && typeof error.status === "number" ? error.status : 500;
  return { status, message: error instanceof Error ? error.message : "Erro interno" };
}

export async function assertWorkspaceTaskVisible(supabase: SupabaseClient, taskId: string | null | undefined) {
  if (!taskId) return;
  const { data, error } = await supabase.from("workspace_tasks").select("id").eq("id", taskId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw Object.assign(new Error("A tarefa selecionada não está disponível no seu Workspace"), { status: 400 });
}

const WORKSPACE_PRIORITY: Record<MarketingPriority, "baixa" | "media" | "alta" | "urgente"> = {
  low: "baixa",
  medium: "media",
  high: "alta",
  urgent: "urgente",
};

function workspaceDeadline(scheduledAt: string | null | undefined) {
  if (!scheduledAt) return { dueDate: null, dueTime: null };
  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) return { dueDate: null, dueTime: null };
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    dueDate: `${value("year")}-${value("month")}-${value("day")}`,
    dueTime: `${value("hour")}:${value("minute")}`,
  };
}

export async function createWorkspaceTaskForMarketing(
  supabase: SupabaseClient,
  context: MarketingServerContext,
  input: {
    title: string;
    description?: string | null;
    priority: MarketingPriority;
    scheduledAt?: string | null;
    assigneeIds?: string[];
    tagIds?: string[];
  },
) {
  const assigneeIds = Array.from(new Set(input.assigneeIds ?? []));
  const tagIds = Array.from(new Set(input.tagIds ?? []));

  if (assigneeIds.length) {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("owner_id", context.organizationId)
      .eq("is_active", true)
      .in("id", assigneeIds);
    if (error) throw new Error(error.message);
    if ((data ?? []).length !== assigneeIds.length) {
      throw Object.assign(new Error("O responsável selecionado não está disponível"), { status: 400 });
    }
  }

  if (tagIds.length) {
    const { data, error } = await supabase.from("tags").select("id").in("id", tagIds);
    if (error) throw new Error(error.message);
    if ((data ?? []).length !== tagIds.length) {
      throw Object.assign(new Error("Uma das etiquetas selecionadas não está disponível"), { status: 400 });
    }
  }

  const { data: maxRow, error: positionError } = await supabase
    .from("workspace_tasks")
    .select("position")
    .eq("user_id", context.user.id)
    .eq("status", "a_fazer")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (positionError) throw new Error(positionError.message);

  const deadline = workspaceDeadline(input.scheduledAt);
  const { data: task, error } = await supabase
    .from("workspace_tasks")
    .insert({
      user_id: context.user.id,
      created_by: context.user.id,
      title: input.title,
      description: input.description ?? null,
      status: "a_fazer",
      priority: WORKSPACE_PRIORITY[input.priority],
      tags: tagIds,
      due_date: deadline.dueDate,
      due_time: deadline.dueTime,
      notes: "Tarefa criada automaticamente pelo calendário de Marketing.",
      position: (maxRow?.position ?? -10) + 10,
    })
    .select("id,title,priority,due_date")
    .single();
  if (error) throw new Error(error.message);

  if (assigneeIds.length) {
    const assigned = await supabase
      .from("workspace_task_assignees")
      .insert(assigneeIds.map((assignee_id) => ({ task_id: task.id, assignee_id })));
    if (assigned.error) {
      await supabase.from("workspace_tasks").delete().eq("id", task.id);
      throw new Error(assigned.error.message);
    }
    try {
      await getPlatformEventBus().publish("task.assigned", {
        taskId: task.id,
        taskTitle: task.title,
        assigneeIds,
        actorUserId: context.user.id,
        priority: task.priority,
        dueDate: task.due_date,
      });
    } catch (error) {
      await supabase.from("workspace_tasks").delete().eq("id", task.id);
      throw error;
    }
  }

  return task.id as string;
}

export async function syncMarketingTags(supabase: SupabaseClient, context: MarketingServerContext, entity: "content" | "idea", entityId: string, names: string[]) {
  const cleanNames = Array.from(new Set(names.map((name) => name.trim().slice(0, 60)).filter(Boolean)));
  const joinTable = entity === "content" ? "marketing_content_tags" : "marketing_idea_tags";
  const idColumn = entity === "content" ? "content_id" : "idea_id";
  const deleted = await supabase.from(joinTable).delete().eq(idColumn, entityId);
  if (deleted.error) throw new Error(deleted.error.message);
  if (!cleanNames.length) return;
  const upserted = await supabase.from("marketing_tags").upsert(cleanNames.map((name) => ({ organization_id: context.organizationId, name, created_by: context.user.id })), { onConflict: "organization_id,name" }).select("id,name");
  if (upserted.error) throw new Error(upserted.error.message);
  const linked = await supabase.from(joinTable).insert((upserted.data ?? []).map((tag) => ({ [idColumn]: entityId, tag_id: tag.id, organization_id: context.organizationId, created_by: context.user.id })));
  if (linked.error) throw new Error(linked.error.message);
}
