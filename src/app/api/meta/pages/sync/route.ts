// POST /api/meta/pages/sync
// Re-fetches pages, refreshes tokens, and subscribes each page to receive leadgen events.

export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { getPagesWithTokens, subscribePageToWebhook } from "@/lib/meta-api";

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: tokenRows } = await supabase
    .from("meta_tokens")
    .select("encrypted_token, platform_account_id")
    .eq("user_id", user.id)
    .not("platform_account_id", "is", null)
    .limit(1);

  if (!tokenRows?.length || !tokenRows[0].encrypted_token) {
    return NextResponse.json({ error: "Nenhuma conta Meta conectada" }, { status: 404 });
  }

  const accessToken       = decryptToken(tokenRows[0].encrypted_token as string);
  const platformAccountId = tokenRows[0].platform_account_id as string;

  let pages: Awaited<ReturnType<typeof getPagesWithTokens>>;
  try {
    pages = await getPagesWithTokens(accessToken);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Falha ao buscar páginas da Meta: ${msg}` }, { status: 502 });
  }

  if (pages.length === 0) {
    return NextResponse.json({ synced: 0, subscribed: 0, pages: [] });
  }

  // Remove stale rows with NULL meta_page_id (left over from old schema versions)
  await supabase
    .from("meta_page_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .is("meta_page_id", null);

  // Upsert fresh page tokens
  const { error: upsertErr } = await supabase
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
        subscribed:           false,
      })),
      { onConflict: "user_id,meta_page_id" }
    );

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  // Subscribe each page to receive leadgen webhook events
  let subscribed = 0;
  const results: { page_id: string; page_name: string; subscribed: boolean; error?: string }[] = [];

  for (const p of pages) {
    if (!p.access_token) {
      results.push({ page_id: p.id, page_name: p.name, subscribed: false, error: "sem page token" });
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
      results.push({ page_id: p.id, page_name: p.name, subscribed: true });
      console.log(`[pages/sync] ✓ subscribed ${p.id} (${p.name})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await supabase
        .from("meta_page_subscriptions")
        .update({ subscribed: false, error_message: msg, last_synced_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("meta_page_id", p.id);
      results.push({ page_id: p.id, page_name: p.name, subscribed: false, error: msg });
      console.warn(`[pages/sync] failed ${p.id}: ${msg}`);
    }
  }

  return NextResponse.json({ synced: pages.length, subscribed, pages: results });
}
