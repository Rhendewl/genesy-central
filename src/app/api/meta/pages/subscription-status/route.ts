// GET /api/meta/pages/subscription-status
// Queries Meta directly to check which apps are subscribed to each page's webhook.
// Use this to diagnose why events are going to the old Make app instead of here.

export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { decryptToken } from "@/lib/crypto";
import { getPageSubscribedApps } from "@/lib/meta-api";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: pages } = await supabase
    .from("meta_page_subscriptions")
    .select("meta_page_id, page_name, encrypted_page_token, subscribed")
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (!pages?.length) {
    return NextResponse.json({ pages: [], message: "Nenhuma página sincronizada." });
  }

  const results = await Promise.all(
    pages.map(async (p) => {
      if (!p.encrypted_page_token) {
        return {
          page_id:          p.meta_page_id,
          page_name:        p.page_name,
          subscribed_in_db: p.subscribed,
          subscribed_apps:  null,
          error:            "Sem page token — clique em Sincronizar",
        };
      }

      try {
        const token = decryptToken(p.encrypted_page_token as string);
        const apps  = await getPageSubscribedApps(p.meta_page_id as string, token);
        return {
          page_id:          p.meta_page_id,
          page_name:        p.page_name,
          subscribed_in_db: p.subscribed,
          subscribed_apps:  apps.map(a => ({
            app_id:   a.id,
            app_name: a.name,
            fields:   a.subscribed_fields,
          })),
          our_app_subscribed: apps.some(
            a => a.id === process.env.META_APP_ID && a.subscribed_fields.includes("leadgen")
          ),
        };
      } catch (err) {
        return {
          page_id:          p.meta_page_id,
          page_name:        p.page_name,
          subscribed_in_db: p.subscribed,
          subscribed_apps:  null,
          error:            err instanceof Error ? err.message : String(err),
        };
      }
    })
  );

  return NextResponse.json({ pages: results });
}
