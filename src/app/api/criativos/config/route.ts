export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// GET /api/criativos/config
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const { data } = await supabase
      .from("criativo_configs")
      .select("openai_api_key, gemini_api_key")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!data) {
      return NextResponse.json({
        configured:        false,
        openai_configured: false,
        gemini_configured: false,
        openai_masked:     null,
        gemini_masked:     null,
      });
    }

    const mask = (key: string | null) =>
      key && key.length > 8 ? `${"•".repeat(12)}${key.slice(-4)}` : null;

    return NextResponse.json({
      configured:        !!(data.openai_api_key || data.gemini_api_key),
      openai_configured: !!data.openai_api_key,
      gemini_configured: !!data.gemini_api_key,
      openai_masked:     mask(data.openai_api_key),
      gemini_masked:     mask(data.gemini_api_key),
    });
  } catch (err) {
    console.error("[criativos/config GET]", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

// POST /api/criativos/config
// PATCH semântico: só atualiza os campos presentes no body.
// Campo presente com string vazia = limpar (null). Campo ausente = manter existente.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const body = await req.json();

    const toValue = (v: unknown): string | null =>
      typeof v === "string" && v.trim().length > 0 ? v.trim() : null;

    // Sempre inclui user_id e os campos obrigatórios para o INSERT no caso de primeira vez
    const payload: Record<string, unknown> = {
      user_id:        user.id,
      provider_copy:  "openai",
      provider_imagem: "openai",
    };

    // Só atualiza as chaves que o frontend enviou explicitamente
    if ("openai_api_key" in body) payload.openai_api_key = toValue(body.openai_api_key);
    if ("gemini_api_key" in body) payload.gemini_api_key = toValue(body.gemini_api_key);

    const { error } = await supabase
      .from("criativo_configs")
      .upsert(payload, { onConflict: "user_id" });

    if (error) {
      console.error("[criativos/config POST]", error);
      return NextResponse.json({ error: "Erro ao salvar configuração." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[criativos/config POST]", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
