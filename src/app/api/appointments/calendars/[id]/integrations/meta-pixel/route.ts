// GET  /api/appointments/calendars/[id]/integrations/meta-pixel → config (token masked)
// PATCH /api/appointments/calendars/[id]/integrations/meta-pixel → save config (token encrypted)

import { NextRequest, NextResponse }          from "next/server";
import { createServerSupabaseClient }         from "@/lib/supabase-server";
import { encryptToken, decryptToken }         from "@/lib/crypto";
import type { AppointmentMetaPixelSettings }  from "@/types/appointments";

type Params = { params: Promise<{ id: string }> };

type MetaPixelPublic = Omit<AppointmentMetaPixelSettings, "access_token"> & {
  access_token_set: boolean;   // true if a token is stored (never expose the value)
};

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

  const raw = (data.settings as Record<string, unknown>)?.meta_pixel as AppointmentMetaPixelSettings | undefined;
  if (!raw) return NextResponse.json({ meta_pixel: null });

  const { access_token, ...rest } = raw;
  const safeResponse: MetaPixelPublic = { ...rest, access_token_set: !!access_token };
  return NextResponse.json({ meta_pixel: safeResponse });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as (Partial<AppointmentMetaPixelSettings> & {
    access_token_plain?: string;   // plaintext from the form; we encrypt before storing
  }) | null;
  if (!body) return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });

  // Read existing settings
  const { data: current, error: fetchErr } = await supabase
    .from("appointment_calendars")
    .select("settings")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Calendário não encontrado" }, { status: 404 });

  const existingSettings = (current.settings ?? {}) as Record<string, unknown>;
  const existingMeta     = (existingSettings.meta_pixel ?? {}) as Partial<AppointmentMetaPixelSettings>;

  // Encrypt token only if a new plaintext token was provided
  let storedToken = existingMeta.access_token ?? "";
  if (body.access_token_plain?.trim()) {
    storedToken = encryptToken(body.access_token_plain.trim());
  }

  const updatedMeta: AppointmentMetaPixelSettings = {
    enabled:          body.enabled          ?? existingMeta.enabled          ?? false,
    pixel_id:         body.pixel_id         ?? existingMeta.pixel_id         ?? "",
    event_name:       body.event_name       ?? existingMeta.event_name       ?? "Chronos_Scheduled",
    event_mode:       body.event_mode       ?? existingMeta.event_mode       ?? "standard",
    access_token:     storedToken,
    test_event_code:  body.test_event_code  ?? existingMeta.test_event_code  ?? null,
  };

  const updatedSettings = { ...existingSettings, meta_pixel: updatedMeta };

  const { error: updateErr } = await supabase
    .from("appointment_calendars")
    .update({ settings: updatedSettings })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  const { access_token, ...safeMeta } = updatedMeta;
  void decryptToken; // imported but only used server-side in sync service
  return NextResponse.json({ ok: true, meta_pixel: { ...safeMeta, access_token_set: !!access_token } });
}
