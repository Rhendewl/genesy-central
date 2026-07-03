// POST /api/google-calendar/disconnect
// Auth required. Removes the Google Calendar connection for the current user.

import { NextResponse }               from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { GoogleConnectionRepository } from "@/lib/google-calendar/google-connection-repository";

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const repo = new GoogleConnectionRepository(supabase);
    await repo.delete(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
