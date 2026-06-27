import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

type Params = { params: Promise<{ slug: string }> };

// POST /api/form/:slug/sessao — inicia uma sessão de visitante.
// Usa admin client para escrever sem autenticação do visitante.
export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const supabase = createAdminSupabaseClient();

  // Carrega o form para obter o form_id e user_id do dono
  const { data: form } = await supabase
    .from("forms")
    .select("id, user_id")
    .eq("slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .single();

  if (!form) {
    return NextResponse.json({ error: "Formulário não encontrado" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, string | undefined>;

  // Coleta metadados do visitante via headers
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? null;
  const language = req.headers.get("accept-language")?.split(",")[0]?.trim() ?? null;
  const referrer = req.headers.get("referer") ?? null;

  const { data: session, error } = await supabase
    .from("form_sessions")
    .insert({
      form_id: form.id,
      user_id: form.user_id,
      device:       body.device       ?? null,
      browser:      body.browser      ?? null,
      os:           body.os           ?? null,
      language:     body.language     ?? language,
      country:      body.country      ?? null,
      ip,
      utm_source:   body.utm_source   ?? null,
      utm_medium:   body.utm_medium   ?? null,
      utm_campaign: body.utm_campaign ?? null,
      utm_term:     body.utm_term     ?? null,
      utm_content:  body.utm_content  ?? null,
      fbclid:       body.fbclid       ?? null,
      gclid:        body.gclid        ?? null,
      referrer:     body.referrer     ?? referrer,
    })
    .select("id, token")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ session_id: session.id, token: session.token }, { status: 201 });
}

// PATCH /api/form/:slug/sessao — atualiza metadados de sessão existente.
// Usado pelo AnalyticsConsumer para enriquecer a sessão com dados de device/UTM
// coletados no cliente após a criação da sessão.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const supabase = createAdminSupabaseClient();

  const body = await req.json() as {
    session_token:    string;
    device?:          string;
    browser?:         string;
    os?:              string;
    language?:        string;
    country?:         string;
    city?:            string;
    utm_source?:      string;
    utm_medium?:      string;
    utm_campaign?:    string;
    utm_term?:        string;
    utm_content?:     string;
    referrer?:        string;
    finished_at?:     string;
    abandoned_at?:    string;
    is_partial?:      boolean;
    steps_completed?: number;
  };

  if (!body.session_token) {
    return NextResponse.json({ error: "session_token é obrigatório" }, { status: 400 });
  }

  const { data: session } = await supabase
    .from("form_sessions")
    .select("id, form_id")
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

  // Build update object — only include defined fields
  const update: Record<string, unknown> = {};
  const fields: Array<keyof typeof body> = [
    "device", "browser", "os", "language", "country", "city",
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "referrer", "finished_at", "abandoned_at", "is_partial", "steps_completed",
  ];
  for (let i = 0; i < fields.length; i++) {
    const key = fields[i];
    if (body[key] !== undefined) update[key] = body[key];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  const { error } = await supabase
    .from("form_sessions")
    .update(update)
    .eq("id", session.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
