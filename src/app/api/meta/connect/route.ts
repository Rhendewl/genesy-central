export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { syncMetaAccount } from "@/lib/meta-sync";
import { getPagesWithTokens, subscribePageToWebhook } from "@/lib/meta-api";
import { format, startOfMonth, endOfToday } from "date-fns";

// POST /api/meta/connect
// Body: { pendingId, adAccountId, adAccountName, clientId? }
// Links the pending OAuth token to a chosen Ad Account + client, then syncs.
export async function POST(req: NextRequest) {
  try {
    const { pendingId, adAccountId, adAccountName, clientId } = await req.json() as {
      pendingId: string;
      adAccountId: string;
      adAccountName: string;
      clientId?: string | null;
    };

    if (!pendingId || !adAccountId || !adAccountName) {
      return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    // Retrieve pending token
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("meta_tokens")
      .select("*")
      .eq("id", pendingId)
      .eq("user_id", user.id)
      .is("platform_account_id", null)
      .single();

    if (tokenErr || !tokenRow || !tokenRow.encrypted_token) {
      return NextResponse.json({ error: "Token pendente não encontrado ou expirado" }, { status: 404 });
    }

    // Upsert ad_platform_accounts record
    const { data: account, error: accErr } = await supabase
      .from("ad_platform_accounts")
      .upsert({
        user_id:      user.id,
        client_id:    clientId ?? null,
        platform:     "meta",
        account_name: adAccountName,
        account_id:   adAccountId,
        status:       "connected",
        last_sync_at: new Date().toISOString(),
      }, { onConflict: "user_id,platform,account_id" })
      .select("id")
      .single();

    if (accErr) throw accErr;

    // Link token → platform account
    await supabase
      .from("meta_tokens")
      .update({ platform_account_id: account.id })
      .eq("id", pendingId);

    const accessToken = decryptToken(tokenRow.encrypted_token as string);

    // Page subscriptions run FIRST — independent of campaign sync success.
    // syncMetaAccount can throw on API/DB errors; page subscription must not be blocked by it.
    await subscribePages({ supabase, userId: user.id, platformAccountId: account.id, accessToken });

    // Campaign sync is best-effort — failure here does not affect lead capture.
    syncMetaAccount({
      supabase,
      userId:            user.id,
      platformAccountId: account.id,
      adAccountId,
      clientId:          clientId ?? null,
      accessToken,
      since: format(startOfMonth(new Date()), "yyyy-MM-dd"),
      until: format(endOfToday(), "yyyy-MM-dd"),
    }).catch(err => console.warn("[meta/connect] syncMetaAccount failed (non-fatal):", err));

    return NextResponse.json({ success: true, accountId: account.id });
  } catch (err) {
    console.error("[meta/connect]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ── Shared helper: fetch pages, save tokens, subscribe to webhook ─────────────

async function subscribePages({
  supabase,
  userId,
  platformAccountId,
  accessToken,
}: {
  supabase:          Awaited<ReturnType<typeof import("@/lib/supabase-server").createServerSupabaseClient>>;
  userId:            string;
  platformAccountId: string;
  accessToken:       string;
}) {
  try {
    const pages = await getPagesWithTokens(accessToken);
    if (pages.length === 0) {
      console.warn("[meta/connect] no pages returned from /me/accounts");
      return;
    }

    // Delete stale rows (meta_page_id IS NULL) left over from old schema versions
    await supabase
      .from("meta_page_subscriptions")
      .delete()
      .eq("user_id", userId)
      .is("meta_page_id", null);

    // Upsert fresh page tokens
    await supabase
      .from("meta_page_subscriptions")
      .upsert(
        pages.map(p => ({
          user_id:              userId,
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

    // Subscribe each page to receive leadgen events
    for (const p of pages) {
      if (!p.access_token) continue;
      try {
        await subscribePageToWebhook(p.id, p.access_token);
        await supabase
          .from("meta_page_subscriptions")
          .update({ subscribed: true, error_message: null, last_synced_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("meta_page_id", p.id);
        console.log(`[meta/connect] ✓ subscribed page ${p.id} (${p.name})`);
      } catch (subErr) {
        const msg = subErr instanceof Error ? subErr.message : String(subErr);
        console.warn(`[meta/connect] failed to subscribe page ${p.id}: ${msg}`);
        await supabase
          .from("meta_page_subscriptions")
          .update({ subscribed: false, error_message: msg })
          .eq("user_id", userId)
          .eq("meta_page_id", p.id);
      }
    }
  } catch (err) {
    console.warn("[meta/connect] subscribePages failed:", err);
  }
}
