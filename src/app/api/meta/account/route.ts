export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// DELETE /api/meta/account
// Body: { platformAccountId }
// Permanently removes a disconnected ad account and all associated integration data.
// Does NOT delete campaigns or campaign_metrics (historical data is preserved).
export async function DELETE(req: NextRequest) {
  try {
    const { platformAccountId } = await req.json() as { platformAccountId: string };
    if (!platformAccountId) {
      return NextResponse.json({ error: "platformAccountId obrigatório" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    // Verify ownership and that account is disconnected
    const { data: account, error: findErr } = await supabase
      .from("ad_platform_accounts")
      .select("id, status")
      .eq("id", platformAccountId)
      .eq("user_id", user.id)
      .single();

    if (findErr || !account) {
      return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
    }

    if (account.status === "connected") {
      return NextResponse.json(
        { error: "Desconecte a conta antes de excluí-la" },
        { status: 409 }
      );
    }

    // Delete associated integration records
    await Promise.all([
      supabase.from("meta_tokens").delete()
        .eq("platform_account_id", platformAccountId).eq("user_id", user.id),
      supabase.from("meta_sync_logs").delete()
        .eq("platform_account_id", platformAccountId).eq("user_id", user.id),
      supabase.from("meta_page_subscriptions").delete()
        .eq("platform_account_id", platformAccountId).eq("user_id", user.id),
    ]);

    // Remove the account record
    const { error: delErr } = await supabase
      .from("ad_platform_accounts")
      .delete()
      .eq("id", platformAccountId)
      .eq("user_id", user.id);

    if (delErr) throw delErr;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[meta/account DELETE]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
