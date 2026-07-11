// PATCH /api/workspace/onboarding/tasks/[taskId]/move — muda o status da tarefa
// Body: { status } — admin do projeto ou o próprio responsável pela tarefa.
// Estados administrativos (bloqueado/aguardando_cliente/cancelado) só via
// PATCH /api/workspace/onboarding/tasks/[taskId] (admin-only).

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { handleOnboardingTaskStatusChange } from "@/lib/onboarding/sync";
import type { OnboardingTaskStatus } from "@/types/onboarding";

type Params = { params: Promise<{ taskId: string }> };

const MOVABLE_STATUSES: OnboardingTaskStatus[] = ["a_fazer", "em_andamento", "aguardando", "concluido"];

export async function PATCH(req: NextRequest, { params }: Params) {
  const { taskId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as { status?: string } | null;
  if (!body?.status || !MOVABLE_STATUSES.includes(body.status as OnboardingTaskStatus)) {
    return NextResponse.json({ error: "status inválido" }, { status: 400 });
  }

  try {
    const { data: task } = await supabase.from("onboarding_tasks").select("assignee_profile_id").eq("id", taskId).maybeSingle();
    if (!task) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });

    const { data: myProfile } = await supabase.from("user_profiles").select("id").eq("auth_user_id", user.id).maybeSingle();
    const { data: isAdmin } = await supabase.rpc("is_admin_of_onboarding_task", { p_task_id: taskId });
    const isAssignee = !!myProfile?.id && task.assignee_profile_id === myProfile.id;

    if (!isAdmin && !isAssignee) {
      return NextResponse.json({ error: "Você não tem permissão para mover esta tarefa" }, { status: 403 });
    }

    await handleOnboardingTaskStatusChange(supabase, taskId, body.status as OnboardingTaskStatus, myProfile?.id ?? null);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
