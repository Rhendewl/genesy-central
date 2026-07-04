import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const MASKED = "__masked__";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const pipelineId = new URL(req.url).searchParams.get("pipeline_id");
  if (!pipelineId) return NextResponse.json({ error: "pipeline_id é obrigatório" }, { status: 400 });

  const { data, error } = await supabase
    .from("platform_integrations")
    .select("*")
    .eq("pipeline_id", pipelineId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sources = (data ?? []).map(row => ({ ...row, access_token: MASKED }));
  return NextResponse.json({ sources });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  const { pipeline_id, name, description, provider, pixel_id, access_token, test_event_code, is_default, is_active } = body;

  if (!pipeline_id || !name || !pixel_id || !access_token) {
    return NextResponse.json({ error: "pipeline_id, name, pixel_id e access_token são obrigatórios" }, { status: 400 });
  }

  const { data: pipeline } = await supabase
    .from("crm_pipelines")
    .select("id")
    .eq("id", pipeline_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!pipeline) return NextResponse.json({ error: "Pipeline não encontrada" }, { status: 404 });

  const { data, error } = await supabase
    .from("platform_integrations")
    .insert({
      user_id:         user.id,
      pipeline_id:     pipeline_id as string,
      name:            (name as string).trim(),
      description:     (description as string | null) ?? null,
      provider:        (provider as string) ?? "meta_pixel",
      pixel_id:        (pixel_id as string).trim(),
      access_token:    (access_token as string).trim(),
      test_event_code: (test_event_code as string | null) ?? null,
      is_default:      (is_default as boolean) ?? false,
      is_active:       (is_active as boolean) ?? true,
      created_by:      user.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Já existe uma origem padrão para este provider nesta pipeline" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ source: { ...data, access_token: MASKED } }, { status: 201 });
}
