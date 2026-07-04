import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type Params = { params: Promise<{ id: string }> };

const VALID_TRIGGERS = new Set(["booking.created", "booking.confirmed", "booking.completed"]);
const VALID_PLATFORMS = new Set(["meta_pixel", "google_ads"]);

export async function GET(_req: NextRequest, { params }: Params) {
  const { id: calendarId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("appointment_conversions")
    .select("*")
    .eq("calendar_id", calendarId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversions: data ?? [] });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id: calendarId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Verify calendar ownership
  const { data: calendar } = await supabase
    .from("appointment_calendars")
    .select("id")
    .eq("id", calendarId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!calendar) return NextResponse.json({ error: "Calendário não encontrado" }, { status: 404 });

  const body = await req.json() as Record<string, unknown>;
  const { trigger_event, platform, enabled, settings, platform_integration_id } = body;

  if (!trigger_event) return NextResponse.json({ error: "trigger_event é obrigatório" }, { status: 400 });
  if (!platform)      return NextResponse.json({ error: "platform é obrigatório" }, { status: 400 });
  if (!VALID_TRIGGERS.has(trigger_event as string)) {
    return NextResponse.json({ error: "trigger_event inválido" }, { status: 400 });
  }
  if (!VALID_PLATFORMS.has(platform as string)) {
    return NextResponse.json({ error: "platform inválido" }, { status: 400 });
  }

  // Validate platform_integration_id belongs to this user.
  if (typeof platform_integration_id === "string" && platform_integration_id.length > 0) {
    const { data: source } = await supabase
      .from("platform_integrations")
      .select("id")
      .eq("id", platform_integration_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!source) return NextResponse.json({ error: "Origem de conversão não encontrada" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("appointment_conversions")
    .upsert(
      {
        calendar_id:             calendarId,
        user_id:                 user.id,
        trigger_event,
        platform,
        platform_integration_id: platform_integration_id ?? null,
        enabled:                 enabled ?? false,
        settings:                settings ?? {},
      },
      { onConflict: "calendar_id,trigger_event,platform" },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversion: data }, { status: 201 });
}
