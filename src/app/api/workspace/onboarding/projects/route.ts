// GET  /api/workspace/onboarding/projects — dashboard: lista projetos + progresso agregado
// POST /api/workspace/onboarding/projects — cria projeto (a partir de um template, ou vazio)

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createMirrorIfNeeded, recordHistory } from "@/lib/onboarding/sync";
import { computeProjectStatus } from "@/lib/onboarding/status";
import { getPlatformEventBus } from "@/lib/event-bus/platform";
import type {
  NewOnboardingProject, OnboardingProject, OnboardingProjectSummary, OnboardingTaskStatus,
} from "@/types/onboarding";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const url    = new URL(req.url);
  const search = url.searchParams.get("search") ?? undefined;
  const mine   = url.searchParams.get("mine") === "1";

  try {
    let query = supabase.from("onboarding_projects").select("*").order("created_at", { ascending: false });
    if (search) query = query.ilike("name", `%${search}%`);

    const { data: projects, error } = await query;
    if (error) throw new Error(error.message);

    let rows = (projects ?? []) as OnboardingProject[];

    if (mine) {
      const { data: myProfile } = await supabase.from("user_profiles").select("id").eq("auth_user_id", user.id).maybeSingle();
      if (myProfile) {
        const { data: myTasks } = await supabase.from("onboarding_tasks").select("project_id").eq("assignee_profile_id", myProfile.id);
        const myProjectIds = new Set((myTasks ?? []).map((t) => t.project_id));
        rows = rows.filter((p) => myProjectIds.has(p.id));
      } else {
        rows = [];
      }
    }

    const projectIds = rows.map((p) => p.id);
    const clientIds  = rows.map((p) => p.client_id).filter((id): id is string => !!id);

    const [{ data: clients }, { data: tasks }, { data: stages }] = await Promise.all([
      clientIds.length > 0
        ? supabase.from("agency_clients").select("id, name").in("id", clientIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      projectIds.length > 0
        ? supabase.from("onboarding_tasks").select("project_id, stage_id, status, weight, due_date").in("project_id", projectIds)
        : Promise.resolve({ data: [] as { project_id: string; stage_id: string; status: OnboardingTaskStatus; weight: number; due_date: string | null }[] }),
      projectIds.length > 0
        ? supabase.from("onboarding_project_stages").select("id, project_id, name, order_index").in("project_id", projectIds).order("order_index")
        : Promise.resolve({ data: [] as { id: string; project_id: string; name: string; order_index: number }[] }),
    ]);

    const clientNameById = new Map((clients ?? []).map((c) => [c.id, c.name]));
    const stageNameById  = new Map((stages ?? []).map((s) => [s.id, s.name]));

    const tasksByProject = new Map<string, typeof tasks>();
    for (const t of tasks ?? []) {
      const cur = tasksByProject.get(t.project_id) ?? [];
      cur.push(t);
      tasksByProject.set(t.project_id, cur);
    }

    const now = Date.now();
    const summaries: OnboardingProjectSummary[] = rows.map((p) => {
      const projectTasks = (tasksByProject.get(p.id) ?? []).filter((t) => t.status !== "cancelado");
      const totalWeight = projectTasks.reduce((sum, t) => sum + t.weight, 0);
      const doneWeight  = projectTasks.filter((t) => t.status === "concluido").reduce((sum, t) => sum + t.weight, 0);
      const progress = totalWeight > 0 ? Math.round((doneWeight / totalWeight) * 100) : 0;

      const overdueTasks = projectTasks.filter((t) => t.status !== "concluido" && t.due_date && new Date(t.due_date).getTime() < now);
      const pendingTasks = projectTasks.filter((t) => t.status !== "concluido");

      const status = computeProjectStatus({
        manualStatus: p.manual_status,
        progress,
        hasOverdue:   overdueTasks.length > 0,
        targetDate:   p.target_date,
      });

      // Etapa atual: primeira etapa (por order_index) que ainda tem tarefa pendente.
      const stageOrder = (stages ?? []).filter((s) => s.project_id === p.id);
      const stageWithPending = stageOrder.find((s) => projectTasks.some((t) => t.stage_id === s.id && t.status !== "concluido"));

      return {
        ...p,
        client_name:        p.client_id ? clientNameById.get(p.client_id) ?? null : null,
        status,
        progress_percent:   progress,
        current_stage_name: stageWithPending ? stageNameById.get(stageWithPending.id) ?? null : null,
        tasks_pending:       pendingTasks.length,
        tasks_overdue:       overdueTasks.length,
      };
    });

    return NextResponse.json({ projects: summaries });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as NewOnboardingProject | null;
  if (!body?.name) return NextResponse.json({ error: "name é obrigatório" }, { status: 400 });

  try {
    const startDate = body.start_date ?? new Date().toISOString().slice(0, 10);

    const { data: templateStages } = body.template_id
      ? await supabase.from("onboarding_template_stages").select("*").eq("template_id", body.template_id).order("order_index")
      : { data: [] as { id: string; name: string; order_index: number; relative_due_days: number; color: string }[] };

    const stageIds = (templateStages ?? []).map((s) => s.id);
    const { data: templateTasks } = stageIds.length > 0
      ? await supabase.from("onboarding_template_tasks").select("*").in("stage_id", stageIds).order("order_index")
      : { data: [] as { id: string; stage_id: string; title: string; description: string | null; role_key: string | null; weight: number; priority: string; relative_due_days: number | null; required_document_labels: string[] }[] };

    const taskIds = (templateTasks ?? []).map((t) => t.id);
    const { data: templateDeps } = taskIds.length > 0
      ? await supabase.from("onboarding_template_task_dependencies").select("task_id, depends_on_task_id").in("task_id", taskIds)
      : { data: [] as { task_id: string; depends_on_task_id: string }[] };

    const { data: templateDocs } = body.template_id
      ? await supabase.from("onboarding_template_documents").select("label, order_index").eq("template_id", body.template_id).order("order_index")
      : { data: [] as { label: string; order_index: number }[] };

    const maxRelativeDays = (templateStages ?? []).reduce((max, s) => Math.max(max, s.relative_due_days), 0);
    const computedTargetDate = body.target_date
      ?? (templateStages && templateStages.length > 0
        ? addDays(startDate, maxRelativeDays)
        : null);

    const { data: project, error: projectError } = await supabase
      .from("onboarding_projects")
      .insert({
        created_by:  user.id,
        client_id:   body.client_id,
        template_id: body.template_id ?? null,
        name:        body.name,
        start_date:  startDate,
        target_date: computedTargetDate,
      })
      .select("*")
      .single();
    if (projectError) throw new Error(projectError.message);

    const { data: actorProfile } = await supabase.from("user_profiles").select("id").eq("auth_user_id", user.id).maybeSingle();

    const stageIdMap = new Map<string, string>();
    if (templateStages && templateStages.length > 0) {
      const { data: newStages, error: stagesError } = await supabase
        .from("onboarding_project_stages")
        .insert(templateStages.map((s) => ({
          project_id:  project.id,
          name:        s.name,
          order_index: s.order_index,
          due_date:    addDays(startDate, s.relative_due_days),
          color:       s.color,
        })))
        .select("id, order_index");
      if (stagesError) throw new Error(stagesError.message);

      // Reconstrói o mapa etapa-template -> etapa-projeto pela ordem (ambos
      // inseridos/ordenados por order_index, preservando o pareamento 1:1).
      const sortedTemplateStages = [...templateStages].sort((a, b) => a.order_index - b.order_index);
      const sortedNewStages = [...(newStages ?? [])].sort((a, b) => a.order_index - b.order_index);
      sortedTemplateStages.forEach((s, idx) => stageIdMap.set(s.id, sortedNewStages[idx].id));
    }

    const roleAssignments = body.role_assignments ?? {};
    const taskIdMap = new Map<string, string>();
    const createdTasks: { id: string; project_id: string; title: string; description: string | null; assignee_profile_id: string | null; priority: string; status: OnboardingTaskStatus; due_date: string | null }[] = [];

    if (templateTasks && templateTasks.length > 0) {
      const depsByTask = new Map<string, string[]>();
      for (const d of templateDeps ?? []) {
        const cur = depsByTask.get(d.task_id) ?? [];
        cur.push(d.depends_on_task_id);
        depsByTask.set(d.task_id, cur);
      }

      const stageById = new Map((templateStages ?? []).map((s) => [s.id, s]));

      const rowsToInsert = templateTasks.map((t) => {
        const stage = stageById.get(t.stage_id)!;
        const assigneeProfileId = t.role_key ? roleAssignments[t.role_key] ?? null : null;
        const hasDeps = (depsByTask.get(t.id) ?? []).length > 0;
        const status: OnboardingTaskStatus = hasDeps ? "bloqueado" : "a_fazer";
        const relativeDays = t.relative_due_days ?? stage.relative_due_days;
        return {
          project_id:               project.id,
          stage_id:                 stageIdMap.get(t.stage_id)!,
          title:                    t.title,
          description:              t.description,
          role_key:                 t.role_key,
          assignee_profile_id:      assigneeProfileId,
          weight:                   t.weight,
          priority:                 t.priority,
          status,
          due_date:                 addDays(startDate, relativeDays),
          required_document_labels: t.required_document_labels,
        };
      });

      const { data: newTasks, error: tasksError } = await supabase
        .from("onboarding_tasks")
        .insert(rowsToInsert)
        .select("id, project_id, title, description, assignee_profile_id, priority, status, due_date");
      if (tasksError) throw new Error(tasksError.message);

      templateTasks.forEach((t, idx) => taskIdMap.set(t.id, newTasks![idx].id));
      createdTasks.push(...(newTasks ?? []));

      const depRows = (templateDeps ?? []).map((d) => ({
        task_id:            taskIdMap.get(d.task_id)!,
        depends_on_task_id: taskIdMap.get(d.depends_on_task_id)!,
      }));
      if (depRows.length > 0) {
        const { error: depsError } = await supabase.from("onboarding_task_dependencies").insert(depRows);
        if (depsError) throw new Error(depsError.message);
      }
    }

    if (templateDocs && templateDocs.length > 0) {
      const { error: docsError } = await supabase
        .from("onboarding_project_documents")
        .insert(templateDocs.map((d) => ({ project_id: project.id, label: d.label })));
      if (docsError) throw new Error(docsError.message);
    }

    await recordHistory(supabase, project.id, actorProfile?.id ?? null, "project_created", { name: project.name });

    for (const task of createdTasks) {
      if (task.status === "a_fazer") await createMirrorIfNeeded(supabase, task);
      if (task.status === "a_fazer" && task.assignee_profile_id) {
        getPlatformEventBus().publish("onboarding.task_assigned", {
          taskId:            task.id,
          taskTitle:         task.title,
          projectId:         project.id,
          projectName:       project.name,
          assigneeProfileId: task.assignee_profile_id,
          actorUserId:       user.id,
        });
      }
    }

    return NextResponse.json({ project: project as OnboardingProject }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
