import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

type Params = { params: Promise<{ slug: string }> };

// POST /api/form/:slug/evento — single event (backward compat)
export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const supabase = createAdminSupabaseClient();

  const body = await req.json() as {
    session_token:    string;
    event:            string;
    step_id?:         string;
    duration?:        number;
    meta?:            Record<string, unknown>;
    idempotency_key?: string;
  };

  if (!body.session_token || !body.event) {
    return NextResponse.json(
      { error: "session_token e event são obrigatórios" },
      { status: 400 },
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

  const row: Record<string, unknown> = {
    form_id:    session.form_id,
    user_id:    session.user_id,
    session_id: session.id,
    step_id:    body.step_id ?? null,
    event:      body.event,
    duration:   body.duration ?? null,
    meta:       body.meta ?? null,
  };
  if (body.idempotency_key) row.idempotency_key = body.idempotency_key;

  await supabase
    .from("form_events")
    .upsert(row, { onConflict: "idempotency_key", ignoreDuplicates: true });

  return NextResponse.json({ ok: true });
}
