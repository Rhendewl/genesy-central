// GET    /api/workspace/objectives/[id] — objetivo + etapas + comentários + anexos
// PATCH  /api/workspace/objectives/[id] — atualiza campos gerais
// DELETE /api/workspace/objectives/[id] — remove objetivo (cascade + limpeza de storage)

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type {
  UpdateWorkspaceObjective, WorkspaceObjective, WorkspaceObjectiveDetail,
  WorkspaceObjectiveStep, WorkspaceObjectiveComment, WorkspaceObjectiveAttachment,
} from "@/types/workspace-objectives";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const [objectiveRes, stepsRes, commentsRes, attachmentsRes] = await Promise.all([
      supabase.from("workspace_objectives").select("*").eq("id", id).maybeSingle(),
      supabase.from("workspace_objective_steps").select("*").eq("objective_id", id).order("position"),
      supabase.from("workspace_objective_comments").select("*").eq("objective_id", id).order("created_at"),
      supabase.from("workspace_objective_attachments").select("*").eq("objective_id", id).order("created_at"),
    ]);

    if (objectiveRes.error) throw new Error(objectiveRes.error.message);
    if (!objectiveRes.data) return NextResponse.json({ error: "Objetivo não encontrado" }, { status: 404 });

    const detail: WorkspaceObjectiveDetail = {
      ...(objectiveRes.data as WorkspaceObjective),
      steps:       (stepsRes.data ?? [])       as WorkspaceObjectiveStep[],
      comments:    (commentsRes.data ?? [])    as WorkspaceObjectiveComment[],
      attachments: (attachmentsRes.data ?? []) as WorkspaceObjectiveAttachment[],
    };

    return NextResponse.json({ objective: detail });
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

  const body = await req.json().catch(() => null) as UpdateWorkspaceObjective | null;
  if (!body) return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const key of ["title", "description", "priority", "assignee_id", "tags", "due_date"] as const) {
    if (key in body) patch[key] = body[key];
  }

  try {
    const { data, error } = await supabase
      .from("workspace_objectives")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ objective: data as WorkspaceObjective });
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
    const { data: attachments } = await supabase
      .from("workspace_objective_attachments")
      .select("storage_path")
      .eq("objective_id", id);

    if (attachments && attachments.length > 0) {
      await supabase.storage.from("criativos").remove(attachments.map((a) => a.storage_path));
    }

    const { error } = await supabase.from("workspace_objectives").delete().eq("id", id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
