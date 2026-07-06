// PATCH  /api/workspace/objectives/[id]/steps/[stepId] — atualiza label/is_completed
// DELETE /api/workspace/objectives/[id]/steps/[stepId] — remove etapa

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { WorkspaceObjectiveStep } from "@/types/workspace-objectives";

type Params = { params: Promise<{ id: string; stepId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { stepId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as { label?: string; is_completed?: boolean } | null;
  if (!body) return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.label === "string") patch.label = body.label;
  if (typeof body.is_completed === "boolean") patch.is_completed = body.is_completed;

  try {
    const { data, error } = await supabase
      .from("workspace_objective_steps")
      .update(patch)
      .eq("id", stepId)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ step: data as WorkspaceObjectiveStep });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { stepId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const { error } = await supabase.from("workspace_objective_steps").delete().eq("id", stepId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
