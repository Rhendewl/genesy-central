export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase-server";

function generateApiKey(): string {
  return "wh_" + randomBytes(24).toString("hex");
}

// POST /api/webhooks/regenerate
// Generates a new API key for the user's webhook integration.
export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const newKey = generateApiKey();

    const { data: updated, error } = await supabase
      .from("webhook_integrations")
      .update({ api_key: newKey })
      .eq("user_id", user.id)
      .select("id, api_key")
      .maybeSingle();

    if (error || !updated) {
      console.error("[api/webhooks/regenerate]", error?.message ?? "not found");
      return NextResponse.json({ error: "Integração não encontrada" }, { status: 404 });
    }

    console.log(`[api/webhooks/regenerate] user=${user.id} key regenerated`);
    return NextResponse.json({ api_key: updated.api_key });
  } catch (err) {
    console.error("[api/webhooks/regenerate]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
