import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { testWebhookIntegration } from "@/lib/forms/webhook-delivery";
import { testServerIntegration } from "@/lib/forms/integration-test";

type Params = { params: Promise<{ id: string; configId: string }> };

export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function POST(_req: NextRequest, { params }: Params) {
  const { id, configId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: form } = await supabase.from("forms").select("id").eq("id", id).eq("user_id", user.id).single();
  if (!form) return NextResponse.json({ error: "Formulário não encontrado" }, { status: 404 });

  try {
    const { data: integration } = await supabase
      .from("form_integrations")
      .select("adapter")
      .eq("id", configId)
      .eq("form_id", id)
      .single();
    if (!integration) return NextResponse.json({ error: "Integração não encontrada" }, { status: 404 });

    const result = integration.adapter === "webhook"
      ? await testWebhookIntegration(supabase, id, configId)
      : await testServerIntegration(supabase, id, configId);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      durationMs: 0,
      error: err instanceof Error ? err.message : "Falha ao testar integração",
      payloadSent: "{}",
      correlationId: "",
    }, { status: 400 });
  }
}
