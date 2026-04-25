import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// GET /api/meta/accounts?pendingId=xxx
// Returns the list of Meta Ad Accounts available for a pending OAuth connection.
export async function GET(req: NextRequest) {
  try {
    const pendingId = req.nextUrl.searchParams.get("pendingId");
    if (!pendingId) {
      return NextResponse.json({ error: "pendingId obrigatório" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { data, error } = await supabase
      .from("meta_tokens")
      .select("id, ad_accounts, created_at")
      .eq("id", pendingId)
      .eq("user_id", user.id)
      .is("platform_account_id", null)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Conexão pendente não encontrada" }, { status: 404 });
    }

    return NextResponse.json({ accounts: data.ad_accounts ?? [] });
  } catch (err) {
    console.error("[meta/accounts]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
