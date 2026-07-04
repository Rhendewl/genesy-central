// GET  /api/crm/notification-rules — list all rules for the authenticated user
// POST /api/crm/notification-rules — create a new rule

import { NextRequest, NextResponse }      from "next/server";
import { createServerSupabaseClient }     from "@/lib/supabase-server";
import type { NewCrmNotificationRule }    from "@/types/crm";

export async function GET(_req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("crm_notification_rules")
    .select(`
      id, pipeline_id, stage_id, enabled, channels, title, body, created_at, updated_at,
      crm_pipelines ( name ),
      crm_stages    ( name, color )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[notification-rules] GET error:", error);
    return NextResponse.json({ error: "Erro ao carregar regras" }, { status: 500 });
  }

  // Flatten join fields so the client receives a flat shape
  const rules = (data ?? []).map(r => ({
    ...r,
    pipeline_name: (r.crm_pipelines as { name?: string } | null)?.name ?? "",
    stage_name:    (r.crm_stages    as { name?: string; color?: string } | null)?.name  ?? "",
    stage_color:   (r.crm_stages    as { name?: string; color?: string } | null)?.color ?? "",
    crm_pipelines: undefined,
    crm_stages:    undefined,
  }));

  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as NewCrmNotificationRule | null;
  if (!body?.pipeline_id || !body?.stage_id) {
    return NextResponse.json({ error: "pipeline_id e stage_id são obrigatórios" }, { status: 400 });
  }

  // Verify stage belongs to the pipeline and to the user
  const { data: stage } = await supabase
    .from("crm_stages")
    .select("id, pipeline_id")
    .eq("id", body.stage_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!stage || stage.pipeline_id !== body.pipeline_id) {
    return NextResponse.json({ error: "Etapa não encontrada" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("crm_notification_rules")
    .insert({
      user_id:     user.id,
      pipeline_id: body.pipeline_id,
      stage_id:    body.stage_id,
      enabled:     body.enabled  ?? true,
      channels:    body.channels ?? ["pwa"],
      title:       body.title    ?? "Novo Lead • {{pipeline_name}}",
      body:        body.body     ?? "{{lead_name}} entrou na etapa {{stage_name}}.",
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Já existe uma regra para esta etapa" }, { status: 409 });
    }
    console.error("[notification-rules] POST error:", error);
    return NextResponse.json({ error: "Erro ao criar regra" }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
