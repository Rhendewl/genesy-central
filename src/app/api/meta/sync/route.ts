export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { syncMetaAccount } from "@/lib/meta-sync";
import { exchangeForLongLivedToken } from "@/lib/meta-api";
import { format, startOfMonth, endOfToday } from "date-fns";

// POST /api/meta/sync
// Body: { platformAccountId, since?, until? }
// Triggers a manual sync for an already-connected Meta Ads account.
export async function POST(req: NextRequest) {
  try {
    const { platformAccountId, since, until } = await req.json() as {
      platformAccountId: string;
      since?: string;
      until?: string;
    };

    if (!platformAccountId) {
      return NextResponse.json({ error: "platformAccountId obrigatório" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    // Retrieve platform account + token
    const { data: account, error: accErr } = await supabase
      .from("ad_platform_accounts")
      .select("id, account_id, client_id, status, include_in_expenses")
      .eq("id", platformAccountId)
      .eq("user_id", user.id)
      .single();

    if (accErr || !account) {
      return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
    }

    const { data: tokenRow, error: tokenErr } = await supabase
      .from("meta_tokens")
      .select("id, encrypted_token, token_expires_at")
      .eq("platform_account_id", platformAccountId)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tokenErr || !tokenRow?.encrypted_token) {
      return NextResponse.json({ error: "Token não encontrado — reconecte a conta" }, { status: 404 });
    }

    // Heal duplicate credentials left by older reconnect flows.
    await supabase
      .from("meta_tokens")
      .delete()
      .eq("platform_account_id", platformAccountId)
      .eq("user_id", user.id)
      .neq("id", tokenRow.id);

    let accessToken = decryptToken(tokenRow.encrypted_token as string);

    // Check token expiry and try to extend a still-valid credential before it
    // reaches the end of its long-lived window.
    if (tokenRow.token_expires_at) {
      const expiresAt = new Date(tokenRow.token_expires_at as string);
      if (expiresAt < new Date()) {
        await supabase
          .from("ad_platform_accounts")
          .update({ status: "error" })
          .eq("id", platformAccountId);
        return NextResponse.json({ error: "Token expirado — reconecte a conta Meta Ads" }, { status: 401 });
      }
      const refreshWindowMs = 7 * 24 * 60 * 60 * 1000;
      if (expiresAt.getTime() - Date.now() <= refreshWindowMs) {
        try {
          const refreshed = await exchangeForLongLivedToken(accessToken);
          if (refreshed.access_token && refreshed.expires_in) {
            const refreshedExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
            accessToken = refreshed.access_token;
            await supabase
              .from("meta_tokens")
              .update({ encrypted_token: encryptToken(accessToken), token_expires_at: refreshedExpiry })
              .eq("platform_account_id", platformAccountId)
              .eq("user_id", user.id);
          }
        } catch (refreshError) {
          // The current token is still valid; continue this sync and only ask
          // for reconnection if Meta actually rejects or expires it.
          console.warn("[meta/sync] preventive token renewal unavailable:", refreshError);
        }
      }
    }

    const result = await syncMetaAccount({
      supabase,
      userId:            user.id,
      platformAccountId: account.id as string,
      adAccountId:       account.account_id as string,
      clientId:          account.client_id as string | null,
      includeInExpenses: account.include_in_expenses as boolean,
      accessToken,
      since: since ?? format(startOfMonth(new Date()), "yyyy-MM-dd"),
      until: until ?? format(endOfToday(), "yyyy-MM-dd"),
    });

    return NextResponse.json({
      success: true,
      campaignsSynced: result.campaignsSynced,
      metricsSynced:   result.metricsSynced,
      metricsSkipped:  result.metricsSkipped,
      warnings:        result.warnings,
    });
  } catch (err) {
    console.error("[meta/sync]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
