// GET  /api/workspace/objectives — lista objetivos
// POST /api/workspace/objectives — cria objetivo

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { NewWorkspaceObjective, WorkspaceObjective } from "@/types/workspace-objectives";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const url        = new URL(req.url);
  const assigneeId = url.searchParams.get("assignee_id") ?? undefined;
  const search     = url.searchParams.get("search")      ?? undefined;

  try {
    let query = supabase.from("workspace_objectives").select("*").order("updated_at", { ascending: false });
    if (assigneeId) query = query.eq("assignee_id", assigneeId);
    if (search)     query = query.ilike("title", `%${search}%`);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ objectives: (data ?? []) as WorkspaceObjective[] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as NewWorkspaceObjective | null;
  if (!body?.title) {
    return NextResponse.json({ error: "title é obrigatório" }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from("workspace_objectives")
      .insert({
        created_by:  user.id,
        title:       body.title,
        description: body.description ?? null,
        priority:    body.priority ?? "media",
        assignee_id: body.assignee_id ?? null,
        tags:        body.tags ?? [],
        due_date:    body.due_date ?? null,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ objective: data as WorkspaceObjective }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
