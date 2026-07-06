// POST /api/workspace/objectives/[id]/comments — cria comentário

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { WorkspaceObjectiveComment } from "@/types/workspace-objectives";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id: objectiveId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as { body?: string } | null;
  if (!body?.body) return NextResponse.json({ error: "body é obrigatório" }, { status: 400 });

  try {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    const { data, error } = await supabase
      .from("workspace_objective_comments")
      .insert({ objective_id: objectiveId, author_id: profile?.id ?? null, body: body.body })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ comment: data as WorkspaceObjectiveComment }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
