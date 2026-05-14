export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// GET /api/webhooks/logs?limit=20
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const limit = Math.min(
      parseInt(req.nextUrl.searchParams.get("limit") ?? "20", 10) || 20,
      50,
    );

    const { data: logs, error } = await supabase
      .from("webhook_logs")
      .select("id, received_at, status, lead_id, error_message, payload")
      .eq("user_id", user.id)
      .order("received_at", { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ logs: logs ?? [] });
  } catch (err) {
    console.error("[api/webhooks/logs]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
