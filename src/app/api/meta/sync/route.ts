import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { decryptToken } from "@/lib/crypto";
import { syncMetaAccount } from "@/lib/meta-sync";
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
      .select("id, account_id, client_id, status")
      .eq("id", platformAccountId)
      .eq("user_id", user.id)
      .single();

    if (accErr || !account) {
      return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
    }

    const { data: tokenRow, error: tokenErr } = await supabase
      .from("meta_tokens")
      .select("encrypted_token, token_expires_at")
      .eq("platform_account_id", platformAccountId)
      .eq("user_id", user.id)
      .single();

    if (tokenErr || !tokenRow?.encrypted_token) {
      return NextResponse.json({ error: "Token não encontrado — reconecte a conta" }, { status: 404 });
    }

    // Check token expiry
    if (tokenRow.token_expires_at) {
      const expiresAt = new Date(tokenRow.token_expires_at as string);
      if (expiresAt < new Date()) {
        await supabase
          .from("ad_platform_accounts")
          .update({ status: "error" })
          .eq("id", platformAccountId);
        return NextResponse.json({ error: "Token expirado — reconecte a conta Meta Ads" }, { status: 401 });
      }
    }

    const accessToken = decryptToken(tokenRow.encrypted_token as string);
    const result = await syncMetaAccount({
      supabase,
      userId:            user.id,
      platformAccountId: account.id as string,
      adAccountId:       account.account_id as string,
      clientId:          account.client_id as string | null,
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
