// GET /api/meta/webhook/logs
// Returns the last N webhook events for the authenticated user, for the debug UI.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 20), 50);

  const { data, error } = await supabase
    .from("meta_webhook_logs")
    .select("id, received_at, page_id, form_id, leadgen_id, status, step, error_message, processed_at, lead_id")
    .eq("user_id", user.id)
    .order("received_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ logs: data ?? [] });
}
