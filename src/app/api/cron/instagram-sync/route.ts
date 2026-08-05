import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { syncInstagramConnection } from "@/lib/instagram-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const received = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? req.headers.get("x-cron-secret");
  if (!expected || received !== expected) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const supabase = createAdminSupabaseClient();
  const staleBefore = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: connections, error } = await supabase
    .from("marketing_instagram_connections")
    .select("id,organization_id,encrypted_access_token,token_expires_at")
    .in("status", ["connected", "error"])
    .or(`last_sync_at.is.null,last_sync_at.lt.${staleBefore}`)
    .limit(2);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = [];
  for (const connection of connections ?? []) {
    try {
      const result = await syncInstagramConnection(supabase, connection);
      results.push({ id: connection.id, success: true, ...result });
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : "Falha na sincronização";
      await supabase.from("marketing_instagram_connections").update({
        status: "error", sync_error: message.slice(0, 500), updated_at: new Date().toISOString(),
      }).eq("id", connection.id);
      results.push({ id: connection.id, success: false, error: message });
    }
  }
  return NextResponse.json({ processed: results.length, results });
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
