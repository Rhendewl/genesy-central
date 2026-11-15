import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { apiError, getMarketingServerContext } from "@/lib/marketing/server";
import { instagramSyncErrorMessage, syncInstagramConnection } from "@/lib/instagram-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  let connectionId: string | undefined;
  let authorizedOrganizationId: string | undefined;
  try {
    const context = await getMarketingServerContext(supabase);
    if (!context.isAdmin) throw Object.assign(new Error("Apenas administradores podem sincronizar contas"), { status: 403 });
    const body = await req.json().catch(() => ({})) as { connectionId?: string };
    connectionId = body.connectionId;
    if (!connectionId) throw Object.assign(new Error("Conta não informada"), { status: 400 });
    const { data: connection, error } = await supabase
      .from("marketing_instagram_connections")
      .select("id,organization_id,instagram_user_id,encrypted_access_token,token_expires_at")
      .eq("id", connectionId)
      .eq("organization_id", context.organizationId)
      .single();
    if (error || !connection) throw Object.assign(new Error("Conta do Instagram não encontrada"), { status: 404 });
    authorizedOrganizationId = context.organizationId;
    // The publication ledger is service-only. Elevate only after validating
    // administrator access and resolving the account within its organization.
    const result = await syncInstagramConnection(createAdminSupabaseClient(), connection);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = instagramSyncErrorMessage(error);
    if (connectionId && authorizedOrganizationId) {
      await supabase.from("marketing_instagram_connections").update({
        status: "error",
        sync_error: message.slice(0, 500),
        updated_at: new Date().toISOString(),
      }).eq("id", connectionId).eq("organization_id", authorizedOrganizationId);
    }
    const parsed = apiError(error);
    return NextResponse.json({ error: message }, { status: parsed.status });
  }
}
