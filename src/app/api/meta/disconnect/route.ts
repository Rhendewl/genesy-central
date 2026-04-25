import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// DELETE /api/meta/disconnect
// Body: { platformAccountId }
// Removes the token and marks the account as disconnected.
export async function DELETE(req: NextRequest) {
  try {
    const { platformAccountId } = await req.json() as { platformAccountId: string };
    if (!platformAccountId) {
      return NextResponse.json({ error: "platformAccountId obrigatório" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    // Delete token
    await supabase
      .from("meta_tokens")
      .delete()
      .eq("platform_account_id", platformAccountId)
      .eq("user_id", user.id);

    // Mark account as disconnected
    const { error } = await supabase
      .from("ad_platform_accounts")
      .update({ status: "disconnected" })
      .eq("id", platformAccountId)
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[meta/disconnect]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
