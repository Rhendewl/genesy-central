// POST /api/workspace/tasks/[id]/checklist — cria item de checklist

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { verifyWorkspaceTaskCreator } from "@/lib/workspace/task-authorization";
import type { WorkspaceTaskChecklistItem } from "@/types/workspace";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id: taskId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as { label?: string; is_completed?: boolean } | null;
  if (!body?.label) return NextResponse.json({ error: "label é obrigatório" }, { status: 400 });

  try {
    const access = await verifyWorkspaceTaskCreator(supabase, taskId, user.id);
    if (!access.allowed) return NextResponse.json({ error: access.error }, { status: access.status });

    const { data: maxRow } = await supabase
      .from("workspace_task_checklist_items")
      .select("position")
      .eq("task_id", taskId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const position = (maxRow?.position ?? -10) + 10;

    const { data, error } = await supabase
      .from("workspace_task_checklist_items")
      .insert({ task_id: taskId, label: body.label, position, is_completed: body.is_completed ?? false })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ item: data as WorkspaceTaskChecklistItem }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
