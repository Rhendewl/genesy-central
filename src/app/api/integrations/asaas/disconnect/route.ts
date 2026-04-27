export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// DELETE /api/integrations/asaas/disconnect
// Soft-removes the integration by setting status = 'disconnected'
// and clearing the encrypted key so it cannot be used.
export async function DELETE() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    // Hard-delete so the upsert on reconnect starts fresh
    const { error } = await supabase
      .from("integrations")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", "asaas");

    if (error) {
      console.error("[asaas/disconnect]", error);
      return NextResponse.json({ error: "Erro ao remover integração." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[asaas/disconnect]", err);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
