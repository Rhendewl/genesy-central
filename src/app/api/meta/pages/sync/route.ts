// POST /api/meta/pages/sync
// Re-fetches pages from Meta API, refreshes tokens, and ensures each page
// is subscribed to receive leadgen webhook events.

export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { getPagesWithTokens, subscribePageToWebhook } from "@/lib/meta-api";

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Find any connected Meta account for this user
  const { data: tokenRows } = await supabase
    .from("meta_tokens")
    .select("encrypted_token, platform_account_id")
    .eq("user_id", user.id)
    .not("platform_account_id", "is", null)
    .limit(1);

  if (!tokenRows?.length || !tokenRows[0].encrypted_token) {
    return NextResponse.json({ error: "Nenhuma conta Meta conectada" }, { status: 404 });
  }

  const accessToken     = decryptToken(tokenRows[0].encrypted_token as string);
  const platformAccountId = tokenRows[0].platform_account_id as string;

  const pages = await getPagesWithTokens(accessToken);

  if (pages.length === 0) {
    return NextResponse.json({ synced: 0, subscribed: 0 });
  }

  // Upsert page tokens
  const { error: upsertError } = await supabase
    .from("meta_page_subscriptions")
    .upsert(
      pages.map(p => ({
        user_id:              user.id,
        platform_account_id:  platformAccountId,
        meta_page_id:         p.id,
        page_id:              p.id,
        page_name:            p.name,
        encrypted_page_token: p.access_token ? encryptToken(p.access_token) : null,
        is_active:            true,
      })),
      { onConflict: "user_id,meta_page_id" }
    );

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  // Subscribe each page to receive leadgen webhook events.
  // Without POST /{page_id}/subscribed_apps Meta never delivers events here.
  let subscribed = 0;
  const subscriptionResults: { page_id: string; page_name: string; subscribed: boolean; error?: string }[] = [];

  for (const p of pages) {
    if (!p.access_token) {
      subscriptionResults.push({ page_id: p.id, page_name: p.name, subscribed: false, error: "no page token" });
      continue;
    }
    try {
      await subscribePageToWebhook(p.id, p.access_token);
      await supabase
        .from("meta_page_subscriptions")
        .update({ subscribed: true, error_message: null, last_synced_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("meta_page_id", p.id);
      subscribed++;
      subscriptionResults.push({ page_id: p.id, page_name: p.name, subscribed: true });
      console.log(`[pages/sync] subscribed page ${p.id} (${p.name}) to webhook`);
    } catch (subErr) {
      const msg = subErr instanceof Error ? subErr.message : String(subErr);
      console.warn(`[pages/sync] failed to subscribe page ${p.id}: ${msg}`);
      await supabase
        .from("meta_page_subscriptions")
        .update({ subscribed: false, error_message: msg, last_synced_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("meta_page_id", p.id);
      subscriptionResults.push({ page_id: p.id, page_name: p.name, subscribed: false, error: msg });
    }
  }

  return NextResponse.json({
    synced:    pages.length,
    subscribed,
    pages:     subscriptionResults,
  });
}
