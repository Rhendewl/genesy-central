import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("crm_stages")
    .select("*")
    .eq("pipeline_id", id)
    .eq("user_id", user.id)
    .order("order_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ stages: data });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id: pipelineId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Verify pipeline ownership
  const { data: pipeline } = await supabase
    .from("crm_pipelines")
    .select("id")
    .eq("id", pipelineId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!pipeline) return NextResponse.json({ error: "Pipeline não encontrado" }, { status: 404 });

  const body = await req.json() as Record<string, unknown>;
  const name = body.name as string | undefined;
  if (!name?.trim()) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

  // Same configurable fields as PUT /[stageId] — client controls all of them on creation.
  const configurable = [
    "description", "color", "icon", "order_index",
    "is_active", "allow_free_move", "require_note", "require_attachment", "allow_edit",
  ] as const;

  const insert: Record<string, unknown> = {
    pipeline_id:        pipelineId,
    user_id:            user.id,
    name:               name.trim(),
    // Defaults applied only when the field is absent from the request body
    color:              "#4a8fd4",
    allow_free_move:    true,
    require_note:       false,
    require_attachment: false,
    allow_edit:         true,
  };
  for (const key of configurable) {
    if (key in body) insert[key] = body[key];
  }

  const { data, error } = await supabase
    .from("crm_stages")
    .insert(insert)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ stage: data }, { status: 201 });
}
