import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { insertFormEvents } from "@/lib/analytics/insert-events";

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

  const { error } = await insertFormEvents(supabase, [{
    form_id:         session.form_id,
    user_id:         session.user_id,
    session_id:      session.id,
    step_id:         body.step_id ?? null,
    event:           body.event,
    duration:        typeof body.duration === "number" ? Math.max(0, Math.round(body.duration)) : null,
    meta:            body.meta ?? null,
    idempotency_key: body.idempotency_key ?? null,
  }]);

  if (error) {
    console.error(`[form/evento] falha ao gravar evento ${body.event} form=${session.form_id}: ${error}`);
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
