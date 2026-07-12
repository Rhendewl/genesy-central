// PATCH  /api/workspace/onboarding/templates/[id]/tasks/[taskId] — atualiza tarefa (incl. dependências)
// DELETE /api/workspace/onboarding/templates/[id]/tasks/[taskId] — remove tarefa

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { OnboardingTemplateTask, UpdateOnboardingTemplateTask } from "@/types/onboarding";

type Params = { params: Promise<{ id: string; taskId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { taskId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as UpdateOnboardingTemplateTask | null;
  if (!body) return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const key of [
    "title", "description", "role_key", "assignee_profile_id", "priority",
    "relative_due_days", "order_index",
  ] as const) {
    if (key in body) patch[key] = body[key];
  }

  try {
    const { data, error } = await supabase
      .from("onboarding_template_tasks")
      .update(patch)
      .eq("id", taskId)
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    let dependsOnTaskIds: string[];
    if (body.depends_on_task_ids) {
      dependsOnTaskIds = body.depends_on_task_ids;
      const { error: deleteError } = await supabase
        .from("onboarding_template_task_dependencies")
        .delete()
        .eq("task_id", taskId);
      if (deleteError) throw new Error(deleteError.message);

      if (dependsOnTaskIds.length > 0) {
        const { error: insertError } = await supabase
          .from("onboarding_template_task_dependencies")
          .insert(dependsOnTaskIds.map((depends_on_task_id) => ({ task_id: taskId, depends_on_task_id })));
        if (insertError) throw new Error(insertError.message);
      }
    } else {
      const { data: depsData } = await supabase
        .from("onboarding_template_task_dependencies")
        .select("depends_on_task_id")
        .eq("task_id", taskId);
      dependsOnTaskIds = (depsData ?? []).map((d) => d.depends_on_task_id);
    }

    return NextResponse.json({ task: { ...data, depends_on_task_ids: dependsOnTaskIds } as OnboardingTemplateTask });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { taskId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const { error } = await supabase.from("onboarding_template_tasks").delete().eq("id", taskId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
