// GET /api/meta/pages — list connected Facebook pages for the current user
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const [{ data: pages, error }, { data: connections }] = await Promise.all([
    supabase
      .from("meta_page_subscriptions")
      .select("id, meta_page_id, page_name, is_active, platform_account_id, created_at")
      .eq("user_id", user.id)
      .order("created_at"),

    supabase
      .from("ad_platform_accounts")
      .select("id")
      .eq("user_id", user.id)
      .eq("platform", "meta")
      .neq("status", "disconnected")
      .limit(1),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Normalize: expose meta_page_id as page_id for client compatibility
  const normalized = (pages ?? []).map(p => ({ ...p, page_id: p.meta_page_id }));

  return NextResponse.json({
    pages:        normalized,
    hasMetaAccount: (connections ?? []).length > 0,
  });
}
