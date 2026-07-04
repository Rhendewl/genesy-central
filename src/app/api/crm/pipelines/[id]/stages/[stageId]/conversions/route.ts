import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type Params = { params: Promise<{ id: string; stageId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { stageId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("crm_stage_conversions")
    .select("*")
    .eq("stage_id", stageId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversions: data });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id: pipelineId, stageId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Verify stage ownership
  const { data: stage } = await supabase
    .from("crm_stages")
    .select("id")
    .eq("id", stageId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!stage) return NextResponse.json({ error: "Etapa não encontrada" }, { status: 404 });

  const body = await req.json() as Record<string, unknown>;
  const { platform, enabled, settings } = body;

  if (!platform) return NextResponse.json({ error: "Plataforma é obrigatória" }, { status: 400 });

  // Verify pixel_integration_id belongs to this user and this pipeline —
  // prevents pointing a stage conversion at another tenant's pixel source.
  const pixelIntegrationId = (settings as Record<string, unknown> | undefined)?.pixel_integration_id;
  if (typeof pixelIntegrationId === "string" && pixelIntegrationId.length > 0) {
    const { data: source } = await supabase
      .from("platform_integrations")
      .select("id")
      .eq("id", pixelIntegrationId)
      .eq("user_id", user.id)
      .eq("pipeline_id", pipelineId)
      .maybeSingle();

    if (!source) {
      return NextResponse.json({ error: "Origem de conversão não encontrada" }, { status: 404 });
    }
  }

  const { data, error } = await supabase
    .from("crm_stage_conversions")
    .upsert(
      {
        stage_id: stageId,
        user_id:  user.id,
        platform,
        enabled:  enabled ?? false,
        settings: settings ?? {},
      },
      { onConflict: "stage_id,platform" },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversion: data }, { status: 201 });
}
