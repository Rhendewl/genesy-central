// GET  /api/appointments/calendars/[id]/integrations/crm → { crm: AppointmentCrmSettings | null }
// PATCH /api/appointments/calendars/[id]/integrations/crm → update calendar settings.crm

import { NextRequest, NextResponse }    from "next/server";
import { createServerSupabaseClient }   from "@/lib/supabase-server";
import type { AppointmentCrmSettings }  from "@/types/appointments";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("appointment_calendars")
    .select("settings")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: "Calendário não encontrado" }, { status: 404 });

  const crm = (data.settings as Record<string, unknown>)?.crm as AppointmentCrmSettings | undefined;
  return NextResponse.json({ crm: crm ?? null });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as Partial<AppointmentCrmSettings> | null;
  if (!body) return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });

  // Validate fields
  if (body.enabled === true && !body.stage_id) {
    return NextResponse.json({ error: "stage_id obrigatório quando integração está ativa" }, { status: 422 });
  }

  // Read current settings to merge
  const { data: current, error: fetchErr } = await supabase
    .from("appointment_calendars")
    .select("settings")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Calendário não encontrado" }, { status: 404 });

  const existingSettings = (current.settings ?? {}) as Record<string, unknown>;
  const updatedSettings  = {
    ...existingSettings,
    crm: {
      enabled:     body.enabled     ?? false,
      pipeline_id: body.pipeline_id ?? null,
      stage_id:    body.stage_id    ?? null,
    } satisfies AppointmentCrmSettings,
  };

  const { error: updateErr } = await supabase
    .from("appointment_calendars")
    .update({ settings: updatedSettings })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, crm: updatedSettings.crm });
}
