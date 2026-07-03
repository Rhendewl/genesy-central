// GET  /api/google-calendar/status  → { connected, connection }
// PATCH /api/google-calendar/status → update auto_create_events

import { NextRequest, NextResponse }  from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { GoogleConnectionRepository } from "@/lib/google-calendar/google-connection-repository";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const repo       = new GoogleConnectionRepository(supabase);
    const connection = await repo.getStatusForUser(user.id);

    return NextResponse.json({
      connected:  !!connection,
      connection: connection ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as { auto_create_events?: boolean } | null;
  if (!body || typeof body.auto_create_events !== "boolean") {
    return NextResponse.json({ error: "Campo 'auto_create_events' obrigatório (boolean)" }, { status: 400 });
  }

  try {
    const repo = new GoogleConnectionRepository(supabase);
    await repo.updateAutoCreateEvents(user.id, body.auto_create_events);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
