// PATCH  /api/workspace/onboarding/projects/[id]/stages/[stageId] — atualiza etapa
// DELETE /api/workspace/onboarding/projects/[id]/stages/[stageId] — remove etapa (cascade em tarefas)

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { OnboardingProjectStage, UpdateOnboardingProjectStage } from "@/types/onboarding";

type Params = { params: Promise<{ id: string; stageId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { stageId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as UpdateOnboardingProjectStage | null;
  if (!body) return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const key of ["name", "order_index", "due_date", "color"] as const) {
    if (key in body) patch[key] = body[key];
  }

  try {
    const { data, error } = await supabase
      .from("onboarding_project_stages")
      .update(patch)
      .eq("id", stageId)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ stage: data as OnboardingProjectStage });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { stageId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const { error } = await supabase.from("onboarding_project_stages").delete().eq("id", stageId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
