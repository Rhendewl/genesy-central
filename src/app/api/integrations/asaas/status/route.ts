export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// GET /api/integrations/asaas/status
// Returns the current Asaas integration row for the authenticated user.
// Returns { connected: false } when no row exists.
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("integrations")
      .select("id, environment, status, last_sync_at, metadata, created_at")
      .eq("user_id", user.id)
      .eq("provider", "asaas")
      .maybeSingle();

    if (error) {
      console.error("[asaas/status]", error);
      return NextResponse.json({ error: "Erro ao buscar integração." }, { status: 500 });
    }

    if (!data || data.status === "disconnected") {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected:    true,
      environment:  data.environment,
      status:       data.status,
      lastSyncAt:   data.last_sync_at,
      accountName:  (data.metadata as Record<string, string> | null)?.accountName ?? null,
      createdAt:    data.created_at,
    });
  } catch (err) {
    console.error("[asaas/status]", err);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
