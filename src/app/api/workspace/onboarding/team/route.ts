// GET /api/workspace/onboarding/team — workload agregado por responsável
// (RLS de onboarding_tasks já escopa isto aos projetos que quem pede consegue
// acessar — admin vê tudo, colaborador vê os projetos onde tem tarefa).

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { OnboardingTeamWorkloadRow } from "@/types/onboarding";

export async function GET(_req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const { data: tasks, error } = await supabase
      .from("onboarding_tasks")
      .select("assignee_profile_id, role_key, status, due_date")
      .not("assignee_profile_id", "is", null);
    if (error) throw new Error(error.message);

    const assigneeIds = Array.from(new Set((tasks ?? []).map((t) => t.assignee_profile_id).filter((id): id is string => !!id)));
    const { data: profiles } = assigneeIds.length > 0
      ? await supabase.from("user_profiles").select("id, full_name, role").in("id", assigneeIds)
      : { data: [] as { id: string; full_name: string; role: string }[] };
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    const profileRoleById = new Map((profiles ?? []).map((p) => [p.id, formatProfileRole(p.role)]));
    const taskRolesByAssignee = new Map<string, Set<string>>();
    for (const t of tasks ?? []) {
      if (!t.assignee_profile_id || !t.role_key) continue;
      const current = taskRolesByAssignee.get(t.assignee_profile_id) ?? new Set<string>();
      current.add(t.role_key);
      taskRolesByAssignee.set(t.assignee_profile_id, current);
    }

    const now = Date.now();
    const byAssignee = new Map<string, OnboardingTeamWorkloadRow>();
    for (const t of tasks ?? []) {
      if (!t.assignee_profile_id) continue;
      const row = byAssignee.get(t.assignee_profile_id) ?? {
        profile_id:      t.assignee_profile_id,
        name:            nameById.get(t.assignee_profile_id) ?? "—",
        function_label:  formatFunctionLabel(taskRolesByAssignee.get(t.assignee_profile_id), profileRoleById.get(t.assignee_profile_id)),
        tasks_total:     0,
        tasks_pending:   0,
        tasks_overdue:   0,
        tasks_completed: 0,
      };
      row.tasks_total += 1;
      if (t.status === "concluido") row.tasks_completed += 1;
      else if (t.status !== "cancelado") {
        row.tasks_pending += 1;
        if (t.due_date && new Date(t.due_date).getTime() < now) row.tasks_overdue += 1;
      }
      byAssignee.set(t.assignee_profile_id, row);
    }

    const rows = Array.from(byAssignee.values()).sort((a, b) => b.tasks_pending - a.tasks_pending);
    return NextResponse.json({ rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function formatFunctionLabel(taskRoles: Set<string> | undefined, fallbackRole: string | undefined): string | null {
  const roles = Array.from(taskRoles ?? []);
  if (roles.length === 1) return roles[0];
  if (roles.length > 1) return roles.slice(0, 2).join(" / ") + (roles.length > 2 ? ` +${roles.length - 2}` : "");
  return fallbackRole ?? null;
}

function formatProfileRole(role: string | null | undefined): string | undefined {
  if (!role) return undefined;
  const labels: Record<string, string> = {
    admin:             "Administrador",
    comercial:         "Comercial",
    gestor_comercial:  "Gestor comercial",
    operacional:       "Operacional",
    cliente:           "Cliente",
  };
  return labels[role] ?? role.replace(/_/g, " ");
}
