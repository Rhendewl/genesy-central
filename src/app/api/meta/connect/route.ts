import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { decryptToken } from "@/lib/crypto";
import { syncMetaAccount } from "@/lib/meta-sync";
import { getPagesWithTokens } from "@/lib/meta-api";
import { encryptToken } from "@/lib/crypto";
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

    // Initial sync for current month
    const accessToken = decryptToken(tokenRow.encrypted_token as string);
    await syncMetaAccount({
      supabase,
      userId:            user.id,
      platformAccountId: account.id,
      adAccountId,
      clientId:          clientId ?? null,
      accessToken,
      since: format(startOfMonth(new Date()), "yyyy-MM-dd"),
      until: format(endOfToday(), "yyyy-MM-dd"),
    });

    // Store page → user mapping with page access tokens
    try {
      const pages = await getPagesWithTokens(accessToken);
      if (pages.length > 0) {
        await supabase
          .from("meta_page_subscriptions")
          .upsert(
            pages.map(p => ({
              user_id:               user.id,
              platform_account_id:   account.id,
              meta_page_id:          p.id,
              page_name:             p.name,
              encrypted_page_token:  p.access_token ? encryptToken(p.access_token) : null,
              is_active:             true,
            })),
            { onConflict: "user_id,meta_page_id" }
          );
      }
    } catch (pageErr) {
      console.warn("[meta/connect] failed to fetch pages:", pageErr);
    }

    return NextResponse.json({ success: true, accountId: account.id });
  } catch (err) {
    console.error("[meta/connect]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
