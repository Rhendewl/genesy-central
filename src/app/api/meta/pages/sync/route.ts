// POST /api/meta/pages/sync
// Re-fetches pages from Meta API and refreshes page tokens in meta_page_subscriptions.
// Needed when user connected before page-token storage was added.

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { getPagesWithTokens } from "@/lib/meta-api";

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

  const accessToken = decryptToken(tokenRows[0].encrypted_token as string);
  const platformAccountId = tokenRows[0].platform_account_id as string;

  const pages = await getPagesWithTokens(accessToken);

  if (pages.length > 0) {
    const { error } = await supabase
      .from("meta_page_subscriptions")
      .upsert(
        pages.map(p => ({
          user_id:              user.id,
          platform_account_id:  platformAccountId,
          meta_page_id:         p.id,
          page_name:            p.name,
          encrypted_page_token: p.access_token ? encryptToken(p.access_token) : null,
          is_active:            true,
        })),
        { onConflict: "user_id,meta_page_id" }
      );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ synced: pages.length });
}
