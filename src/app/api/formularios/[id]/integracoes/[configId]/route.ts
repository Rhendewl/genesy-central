import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { encryptToken } from "@/lib/crypto";

type Params = { params: Promise<{ id: string; configId: string }> };

const MASK = "__masked__";

function maskSecrets(secrets: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.keys(secrets).map(k => [k, MASK]));
}

function encryptWebhookSecrets(secrets: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(secrets).map(([key, value]) => {
    const text = String(value ?? "");
    return [key, !text || text.startsWith("enc:") ? text : `enc:${encryptToken(text)}`];
  }));
}

// Keeps existing secret values when the client sends back the mask sentinel
async function mergeSecrets(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  configId: string,
  incomingSecrets: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { data } = await supabase
    .from("form_integrations")
    .select("secrets")
    .eq("id", configId)
    .single();

  const existing = (data?.secrets ?? {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(incomingSecrets)) {
    merged[k] = v === MASK ? existing[k] : v;
  }
  return merged;
}

// PUT /api/formularios/:id/integracoes/:configId
export async function PUT(req: NextRequest, { params }: Params) {
  const { id, configId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json();
  const { enabled, settings, secrets: incomingSecrets, event_filter, retry_policy, rate_limit } = body;

  const { data: existingConfig } = await supabase
    .from("form_integrations")
    .select("adapter")
    .eq("id", configId)
    .eq("form_id", id)
    .maybeSingle();
  if (!existingConfig) return NextResponse.json({ error: "Integração não encontrada" }, { status: 404 });

  if (existingConfig.adapter === "webhook" && enabled !== false) {
    try {
      const url = new URL(settings?.url ?? "");
      if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
        throw new Error();
      }
    } catch {
      return NextResponse.json({ error: "Informe uma URL HTTPS válida para o webhook" }, { status: 400 });
    }
  }

  let secrets = await mergeSecrets(supabase, configId, incomingSecrets ?? {});
  if (existingConfig.adapter === "webhook") {
    try {
      secrets = encryptWebhookSecrets(secrets);
    } catch {
      return NextResponse.json({ error: "TOKEN_ENCRYPTION_KEY não configurada para proteger o segredo do webhook" }, { status: 500 });
    }
  }

  const { data, error } = await supabase
    .from("form_integrations")
    .update({
      enabled,
      settings,
      secrets,
      event_filter: event_filter ?? null,
      retry_policy: retry_policy ?? null,
      rate_limit:   rate_limit   ?? null,
      updated_at:   new Date().toISOString(),
    })
    .eq("id", configId)
    .eq("form_id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ integration: { ...data, secrets: maskSecrets(data.secrets ?? {}) } });
}

// DELETE /api/formularios/:id/integracoes/:configId
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, configId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { error } = await supabase
    .from("form_integrations")
    .delete()
    .eq("id", configId)
    .eq("form_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
