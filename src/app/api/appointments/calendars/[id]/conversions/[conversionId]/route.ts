import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type Params = { params: Promise<{ id: string; conversionId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const { id: calendarId, conversionId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  const allowed = ["enabled", "settings"] as const;
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
  }

  // Validate pixel_integration_id when settings is being updated
  if (update.settings) {
    const pixelId = (update.settings as Record<string, unknown>)?.pixel_integration_id;
    if (typeof pixelId === "string" && pixelId.length > 0) {
      const { data: source } = await supabase
        .from("platform_integrations")
        .select("id")
        .eq("id", pixelId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!source) return NextResponse.json({ error: "Origem de conversão não encontrada" }, { status: 404 });
    }
  }

  const { data, error } = await supabase
    .from("appointment_conversions")
    .update(update)
    .eq("id", conversionId)
    .eq("calendar_id", calendarId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") return NextResponse.json({ error: "Conversão não encontrada" }, { status: 404 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ conversion: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id: calendarId, conversionId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { error } = await supabase
    .from("appointment_conversions")
    .delete()
    .eq("id", conversionId)
    .eq("calendar_id", calendarId)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
