export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase-server";

function generateApiKey(): string {
  return "wh_" + randomBytes(24).toString("hex");
}

// GET /api/webhooks
// Returns the user's webhook integration, auto-creating one if it doesn't exist.
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    let { data: integration } = await supabase
      .from("webhook_integrations")
      .select("id, api_key, leads_count, last_received_at, is_active")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!integration) {
      const { data: created, error: createErr } = await supabase
        .from("webhook_integrations")
        .insert({ user_id: user.id, api_key: generateApiKey(), name: "Webhook" })
        .select("id, api_key, leads_count, last_received_at, is_active")
        .single();

      if (createErr) {
        console.error("[api/webhooks GET] create error:", createErr.message);
        return NextResponse.json({ error: "Erro ao criar integração" }, { status: 500 });
      }
      integration = created;
    }

    return NextResponse.json({ integration });
  } catch (err) {
    console.error("[api/webhooks GET]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
