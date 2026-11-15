import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { getMarketingServerContext } from "@/lib/marketing/server";
import type { SupabaseClient } from "@supabase/supabase-js";
export const studioFail = (message: string, status = 400) => Object.assign(new Error(message), { status });
export async function studioContext(adminOnly = true) {
  const client = await createServerSupabaseClient();
  const ctx = await getMarketingServerContext(client);
  if (adminOnly && !ctx.isAdmin) throw studioFail("Apenas administradores podem gerenciar publicações.", 403);
  return { client, ctx, db: createAdminSupabaseClient() };
}
export async function studioAccount(db: SupabaseClient, organizationId: string, id: string) {
  const result = await db.from("marketing_instagram_connections").select("id,username,status,requested_scopes,token_expires_at")
    .eq("id", id).eq("organization_id", organizationId).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw studioFail("Conta do Instagram não encontrada.", 404);
  if (!canPublishStudio(result.data)) throw studioFail("Reconecte esta conta para autorizar publicações.");
  return result.data;
}
export function canPublishStudio(account: { status: string; requested_scopes?: string[] | null; token_expires_at?: string | null }) {
  return account.status !== "disconnected" && Boolean(account.requested_scopes?.includes("instagram_business_content_publish")) &&
    (!account.token_expires_at || Date.parse(account.token_expires_at) > Date.now());
}
