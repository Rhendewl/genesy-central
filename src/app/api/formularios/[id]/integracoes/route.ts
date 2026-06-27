import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type Params = { params: Promise<{ id: string }> };

const MASK = "__masked__";

function maskSecrets(secrets: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.keys(secrets).map(k => [k, MASK])
  );
}

// GET /api/formularios/:id/integracoes
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("form_integrations")
    .select("*")
    .eq("form_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const safe = (data ?? []).map(row => ({
    ...row,
    secrets: maskSecrets(row.secrets ?? {}),
  }));

  return NextResponse.json({ integrations: safe });
}

// POST /api/formularios/:id/integracoes
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json();
  const { adapter, enabled = true, settings = {}, secrets = {}, event_filter, retry_policy, rate_limit } = body;

  if (!adapter) return NextResponse.json({ error: "adapter é obrigatório" }, { status: 400 });

  const { data, error } = await supabase
    .from("form_integrations")
    .insert({
      form_id: id,
      adapter,
      enabled,
      settings,
      secrets,
      event_filter: event_filter ?? null,
      retry_policy: retry_policy ?? null,
      rate_limit:   rate_limit   ?? null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ integration: { ...data, secrets: maskSecrets(data.secrets ?? {}) } }, { status: 201 });
}
