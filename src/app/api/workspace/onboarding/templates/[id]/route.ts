// GET    /api/workspace/onboarding/templates/[id] — template + etapas + tarefas
// PATCH  /api/workspace/onboarding/templates/[id] — atualiza name/description/is_active
// DELETE /api/workspace/onboarding/templates/[id] — remove template (cascade em etapas/tarefas)

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type {
  OnboardingTemplate, OnboardingTemplateStage, OnboardingTemplateTask,
  OnboardingTemplateDetail, UpdateOnboardingTemplate,
} from "@/types/onboarding";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const [templateRes, stagesRes] = await Promise.all([
      supabase.from("onboarding_templates").select("*").eq("id", id).maybeSingle(),
      supabase.from("onboarding_template_stages").select("*").eq("template_id", id).order("order_index"),
    ]);

    if (templateRes.error) throw new Error(templateRes.error.message);
    if (!templateRes.data) return NextResponse.json({ error: "Template não encontrado" }, { status: 404 });

    const stages = (stagesRes.data ?? []) as OnboardingTemplateStage[];
    const stageIds = stages.map((s) => s.id);

    const { data: tasksData } = stageIds.length > 0
      ? await supabase.from("onboarding_template_tasks").select("*").in("stage_id", stageIds).order("order_index")
      : { data: [] as OnboardingTemplateTask[] };

    const tasks = (tasksData ?? []) as OnboardingTemplateTask[];
    const taskIds = tasks.map((t) => t.id);
    const assigneeIds = Array.from(new Set(tasks.map((t) => t.assignee_profile_id).filter((profileId): profileId is string => !!profileId)));

    const [{ data: depsData }, { data: assigneesData }] = await Promise.all([
      taskIds.length > 0
        ? supabase.from("onboarding_template_task_dependencies").select("task_id, depends_on_task_id").in("task_id", taskIds)
        : Promise.resolve({ data: [] as { task_id: string; depends_on_task_id: string }[] }),
      assigneeIds.length > 0
        ? supabase.from("user_profiles").select("id, full_name").in("id", assigneeIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    ]);

    const assigneeNameById = new Map((assigneesData ?? []).map((profile) => [profile.id, profile.full_name]));

    const depsByTask = new Map<string, string[]>();
    for (const d of depsData ?? []) {
      const cur = depsByTask.get(d.task_id) ?? [];
      cur.push(d.depends_on_task_id);
      depsByTask.set(d.task_id, cur);
    }

    const tasksByStage = new Map<string, OnboardingTemplateTask[]>();
    for (const t of tasks) {
      const cur = tasksByStage.get(t.stage_id) ?? [];
      cur.push({
        ...t,
        depends_on_task_ids: depsByTask.get(t.id) ?? [],
        assignee_name:       t.assignee_profile_id ? assigneeNameById.get(t.assignee_profile_id) ?? null : null,
      });
      tasksByStage.set(t.stage_id, cur);
    }

    const detail: OnboardingTemplateDetail = {
      ...(templateRes.data as OnboardingTemplate),
      stages:    stages.map((s) => ({ ...s, tasks: tasksByStage.get(s.id) ?? [] })),
      documents: [],
    };

    return NextResponse.json({ template: detail });
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

  const body = await req.json().catch(() => null) as UpdateOnboardingTemplate | null;
  if (!body) return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const key of ["name", "description", "is_active"] as const) {
    if (key in body) patch[key] = body[key];
  }

  try {
    const { data, error } = await supabase
      .from("onboarding_templates")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ template: data as OnboardingTemplate });
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
    const { error } = await supabase.from("onboarding_templates").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
