// POST /api/workspace/objectives/[id]/steps — cria etapa

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { WorkspaceObjectiveStep } from "@/types/workspace-objectives";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id: objectiveId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as { label?: string } | null;
  if (!body?.label) return NextResponse.json({ error: "label é obrigatório" }, { status: 400 });

  try {
    const { data: maxRow } = await supabase
      .from("workspace_objective_steps")
      .select("position")
      .eq("objective_id", objectiveId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const position = (maxRow?.position ?? -10) + 10;

    const { data, error } = await supabase
      .from("workspace_objective_steps")
      .insert({ objective_id: objectiveId, label: body.label, position })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ step: data as WorkspaceObjectiveStep }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
