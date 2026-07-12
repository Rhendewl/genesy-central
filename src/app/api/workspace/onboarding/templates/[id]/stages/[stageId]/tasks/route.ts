// POST /api/workspace/onboarding/templates/[id]/stages/[stageId]/tasks — cria tarefa na etapa

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { NewOnboardingTemplateTask, OnboardingTemplateTask } from "@/types/onboarding";

type Params = { params: Promise<{ id: string; stageId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { stageId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as NewOnboardingTemplateTask | null;
  if (!body?.title) return NextResponse.json({ error: "title é obrigatório" }, { status: 400 });

  try {
    const { data: maxRow } = await supabase
      .from("onboarding_template_tasks")
      .select("order_index")
      .eq("stage_id", stageId)
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle();

    const order_index = body.order_index ?? (maxRow?.order_index ?? -1) + 1;

    const { data, error } = await supabase
      .from("onboarding_template_tasks")
      .insert({
        stage_id:                  stageId,
        title:                     body.title,
        description:               body.description ?? null,
        role_key:                  body.role_key ?? null,
        assignee_profile_id:       body.assignee_profile_id ?? null,
        weight:                    1,
        priority:                  body.priority ?? "media",
        relative_due_days:         body.relative_due_days ?? null,
        required_document_labels: [],
        order_index,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    const dependsOnTaskIds = body.depends_on_task_ids ?? [];
    if (dependsOnTaskIds.length > 0) {
      const { error: depsError } = await supabase
        .from("onboarding_template_task_dependencies")
        .insert(dependsOnTaskIds.map((depends_on_task_id) => ({ task_id: data.id, depends_on_task_id })));
      if (depsError) throw new Error(depsError.message);
    }

    return NextResponse.json(
      { task: { ...data, depends_on_task_ids: dependsOnTaskIds } as OnboardingTemplateTask },
      { status: 201 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
