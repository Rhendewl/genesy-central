// GET    /api/workspace/onboarding/projects/[id] — projeto + etapas + tarefas
// PATCH  /api/workspace/onboarding/projects/[id] — nome/prazo/status manual (admin)
// DELETE /api/workspace/onboarding/projects/[id] — remove projeto (admin, cascade)

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { computeProjectStatus } from "@/lib/onboarding/status";
import type {
  OnboardingProject, OnboardingProjectDetail, OnboardingProjectStage, OnboardingTask,
  UpdateOnboardingProject,
} from "@/types/onboarding";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const { data: project, error } = await supabase.from("onboarding_projects").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!project) return NextResponse.json({ error: "Onboarding não encontrado" }, { status: 404 });

    const [{ data: client }, { data: stages }] = await Promise.all([
      project.client_id ? supabase.from("agency_clients").select("name").eq("id", project.client_id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("onboarding_project_stages").select("*").eq("project_id", id).order("order_index"),
    ]);

    const stageIds = (stages ?? []).map((s) => s.id);
    const { data: tasksData } = stageIds.length > 0
      ? await supabase.from("onboarding_tasks").select("*").in("stage_id", stageIds).order("position")
      : { data: [] as OnboardingTask[] };

    const tasks = (tasksData ?? []) as OnboardingTask[];
    const taskIds = tasks.map((t) => t.id);

    const [{ data: deps }, { data: checklists }, { data: comments }, { data: profiles }] = await Promise.all([
      taskIds.length > 0 ? supabase.from("onboarding_task_dependencies").select("task_id, depends_on_task_id").in("task_id", taskIds) : Promise.resolve({ data: [] as { task_id: string; depends_on_task_id: string }[] }),
      taskIds.length > 0 ? supabase.from("onboarding_task_checklist_items").select("task_id, is_completed").in("task_id", taskIds) : Promise.resolve({ data: [] as { task_id: string; is_completed: boolean }[] }),
      taskIds.length > 0 ? supabase.from("onboarding_task_comments").select("task_id").in("task_id", taskIds) : Promise.resolve({ data: [] as { task_id: string }[] }),
      supabase.from("user_profiles").select("id, full_name"),
    ]);

    const profileNameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    const depsByTask = new Map<string, string[]>();
    for (const d of deps ?? []) {
      const cur = depsByTask.get(d.task_id) ?? [];
      cur.push(d.depends_on_task_id);
      depsByTask.set(d.task_id, cur);
    }
    const checklistByTask = new Map<string, { total: number; done: number }>();
    for (const c of checklists ?? []) {
      const cur = checklistByTask.get(c.task_id) ?? { total: 0, done: 0 };
      cur.total += 1;
      if (c.is_completed) cur.done += 1;
      checklistByTask.set(c.task_id, cur);
    }
    const commentCountByTask = new Map<string, number>();
    for (const c of comments ?? []) {
      commentCountByTask.set(c.task_id, (commentCountByTask.get(c.task_id) ?? 0) + 1);
    }

    const tasksByStage = new Map<string, OnboardingTask[]>();
    for (const t of tasks) {
      const enriched: OnboardingTask = {
        ...t,
        assignee_name:       t.assignee_profile_id ? profileNameById.get(t.assignee_profile_id) ?? null : null,
        depends_on_task_ids: depsByTask.get(t.id) ?? [],
        checklist_total:     checklistByTask.get(t.id)?.total ?? 0,
        checklist_done:      checklistByTask.get(t.id)?.done ?? 0,
        comment_count:       commentCountByTask.get(t.id) ?? 0,
      };
      const cur = tasksByStage.get(t.stage_id) ?? [];
      cur.push(enriched);
      tasksByStage.set(t.stage_id, cur);
    }

    const nonCancelled = tasks.filter((t) => t.status !== "cancelado");
    const doneTasks = nonCancelled.filter((t) => t.status === "concluido").length;
    const progress = nonCancelled.length > 0 ? Math.round((doneTasks / nonCancelled.length) * 100) : 0;
    const hasOverdue = nonCancelled.some((t) => t.status !== "concluido" && t.due_date && new Date(t.due_date).getTime() < Date.now());

    const status = computeProjectStatus({
      manualStatus: project.manual_status,
      progress,
      hasOverdue,
      targetDate: project.target_date,
    });

    const detail: OnboardingProjectDetail = {
      ...(project as OnboardingProject),
      client_name: client?.name ?? null,
      status,
      stages: (stages ?? []).map((s: OnboardingProjectStage) => {
        const stageTasks = tasksByStage.get(s.id) ?? [];
        const activeStageTasks = stageTasks.filter((t) => t.status !== "cancelado");
        const stageDone = activeStageTasks.filter((t) => t.status === "concluido").length;
        return {
          ...s,
          progress_percent: activeStageTasks.length > 0 ? Math.round((stageDone / activeStageTasks.length) * 100) : 0,
          tasks: stageTasks,
        };
      }),
    };

    return NextResponse.json({ project: detail });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as UpdateOnboardingProject | null;
  if (!body) return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const key of ["name", "target_date", "manual_status"] as const) {
    if (key in body) patch[key] = body[key];
  }

  try {
    const { data, error } = await supabase.from("onboarding_projects").update(patch).eq("id", id).select("*").single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ project: data as OnboardingProject });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const { error } = await supabase.from("onboarding_projects").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
