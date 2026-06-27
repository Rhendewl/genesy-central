import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import type { AnalyticsEventRecord } from "@/lib/analytics/types";

type Params = { params: Promise<{ slug: string }> };

// POST /api/form/:slug/evento/batch
// Receives up to 50 analytics events in a single request.
// Idempotent: duplicate idempotency_keys are silently ignored (ON CONFLICT DO NOTHING).
export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const supabase = createAdminSupabaseClient();

  const body = await req.json() as {
    session_token: string;
    events:        AnalyticsEventRecord[];
  };

  if (!body.session_token || !Array.isArray(body.events) || body.events.length === 0) {
    return NextResponse.json(
      { error: "session_token e events[] são obrigatórios" },
      { status: 400 },
    );
  }

  if (body.events.length > 50) {
    return NextResponse.json(
      { error: "Máximo 50 eventos por lote" },
      { status: 422 },
    );
  }

  const { data: session } = await supabase
    .from("form_sessions")
    .select("id, form_id, user_id")
    .eq("token", body.session_token)
    .single();

  if (!session) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

  const { data: form } = await supabase
    .from("forms")
    .select("id")
    .eq("id", session.form_id)
    .eq("slug", slug)
    .single();

  if (!form) return NextResponse.json({ error: "Formulário inválido" }, { status: 403 });

  const rows = body.events.map(evt => ({
    form_id:         session.form_id,
    user_id:         session.user_id,
    session_id:      session.id,
    event:           evt.event,
    step_id:         evt.step_id   ?? null,
    duration:        evt.duration  ?? null,
    meta:            evt.meta      ?? null,
    idempotency_key: evt.idempotency_key ?? null,
  }));

  const { error } = await supabase
    .from("form_events")
    .upsert(rows, { onConflict: "idempotency_key", ignoreDuplicates: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, saved: rows.length });
}
