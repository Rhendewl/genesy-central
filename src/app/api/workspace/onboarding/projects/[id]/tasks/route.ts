// POST /api/workspace/onboarding/projects/[id]/tasks — cria tarefa avulsa (fora do template) numa etapa

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createMirrorIfNeeded, recordHistory } from "@/lib/onboarding/sync";
import { renderOnboardingTaskTitle } from "@/lib/onboarding/task-title-tokens";
import { getPlatformEventBus } from "@/lib/event-bus/platform";
import type { NewOnboardingTask, OnboardingTask, OnboardingTaskStatus } from "@/types/onboarding";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as (NewOnboardingTask & { depends_on_task_ids?: string[] }) | null;
  if (!body?.title || !body?.stage_id) {
    return NextResponse.json({ error: "title e stage_id são obrigatórios" }, { status: 400 });
  }

  try {
    const { data: maxRow } = await supabase
      .from("onboarding_tasks")
      .select("position")
      .eq("stage_id", body.stage_id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const position = (maxRow?.position ?? -10) + 10;

    const dependsOnTaskIds = body.depends_on_task_ids ?? [];
    const status: OnboardingTaskStatus = dependsOnTaskIds.length > 0 ? "bloqueado" : "a_fazer";
    const title = renderOnboardingTaskTitle(body.title, await getProjectClientName(supabase, id));

    const { data, error } = await supabase
      .from("onboarding_tasks")
      .insert({
        created_by:               user.id,
        project_id:               id,
        stage_id:                 body.stage_id,
        title,
        description:               body.description ?? null,
        role_key:                 body.role_key ?? null,
        assignee_profile_id:      body.assignee_profile_id ?? null,
        weight:                   1,
        priority:                 body.priority ?? "media",
        status,
        due_date:                 body.due_date ?? null,
        due_time:                 body.due_time ?? null,
        position,
        required_document_labels: [],
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    if (dependsOnTaskIds.length > 0) {
      const { error: depsError } = await supabase
        .from("onboarding_task_dependencies")
        .insert(dependsOnTaskIds.map((depends_on_task_id) => ({ task_id: data.id, depends_on_task_id })));
      if (depsError) throw new Error(depsError.message);
    }

    const { data: actorProfile } = await supabase.from("user_profiles").select("id").eq("auth_user_id", user.id).maybeSingle();
    await recordHistory(supabase, id, actorProfile?.id ?? null, "task_created", { task_title: data.title });

    if (status === "a_fazer") {
      await createMirrorIfNeeded(supabase, data);
      if (data.assignee_profile_id) {
        const { data: project } = await supabase.from("onboarding_projects").select("name").eq("id", id).maybeSingle();
        getPlatformEventBus().publish("onboarding.task_assigned", {
          taskId:            data.id,
          taskTitle:         data.title,
          projectId:         id,
          projectName:       project?.name ?? "",
          assigneeProfileId: data.assignee_profile_id,
          actorUserId:       user.id,
        });
      }
    }

    return NextResponse.json({ task: { ...data, depends_on_task_ids: dependsOnTaskIds } as OnboardingTask }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function getProjectClientName(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, projectId: string): Promise<string | null> {
  const { data: project } = await supabase
    .from("onboarding_projects")
    .select("client_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project?.client_id) return null;

  const { data: client } = await supabase
    .from("agency_clients")
    .select("name")
    .eq("id", project.client_id)
    .maybeSingle();

  return client?.name ?? null;
}
