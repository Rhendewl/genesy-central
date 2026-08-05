import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { apiError, getMarketingServerContext } from "@/lib/marketing/server";
import { syncInstagramConnection } from "@/lib/instagram-sync";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  let connectionId: string | undefined;
  try {
    const context = await getMarketingServerContext(supabase);
    if (!context.isAdmin) throw Object.assign(new Error("Apenas administradores podem sincronizar contas"), { status: 403 });
    const body = await req.json().catch(() => ({})) as { connectionId?: string };
    connectionId = body.connectionId;
    if (!connectionId) throw Object.assign(new Error("Conta não informada"), { status: 400 });
    const { data: connection, error } = await supabase
      .from("marketing_instagram_connections")
      .select("id,organization_id,encrypted_access_token,token_expires_at")
      .eq("id", connectionId)
      .eq("organization_id", context.organizationId)
      .single();
    if (error || !connection) throw Object.assign(new Error("Conta do Instagram não encontrada"), { status: 404 });
    const result = await syncInstagramConnection(supabase, connection);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (connectionId) {
      await supabase.from("marketing_instagram_connections").update({
        status: "error",
        sync_error: error instanceof Error ? error.message.slice(0, 500) : "Falha na sincronização",
        updated_at: new Date().toISOString(),
      }).eq("id", connectionId);
    }
    const parsed = apiError(error);
    return NextResponse.json({ error: parsed.message }, { status: parsed.status });
  }
}
