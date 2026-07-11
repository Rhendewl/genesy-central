// POST /api/workspace/onboarding/tasks/[taskId]/comments — cria comentário

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { recordHistory } from "@/lib/onboarding/sync";
import { getPlatformEventBus } from "@/lib/event-bus/platform";
import type { OnboardingTaskComment } from "@/types/onboarding";

type Params = { params: Promise<{ taskId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { taskId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as { body?: string } | null;
  if (!body?.body) return NextResponse.json({ error: "body é obrigatório" }, { status: 400 });

  try {
    const { data: profile } = await supabase.from("user_profiles").select("id").eq("auth_user_id", user.id).maybeSingle();

    const { data, error } = await supabase
      .from("onboarding_task_comments")
      .insert({ task_id: taskId, author_id: profile?.id ?? null, body: body.body })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    const { data: task } = await supabase.from("onboarding_tasks").select("project_id, title").eq("id", taskId).maybeSingle();
    if (task) {
      await recordHistory(supabase, task.project_id, profile?.id ?? null, "comment_added", { task_title: task.title });
      getPlatformEventBus().publish("onboarding.comment_added", {
        taskId, taskTitle: task.title, projectId: task.project_id, actorUserId: user.id,
      });
    }

    return NextResponse.json({ comment: data as OnboardingTaskComment }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
