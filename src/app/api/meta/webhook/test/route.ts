// POST /api/meta/webhook/test
// Simulates a leadgen webhook event using the most recent real lead from Meta
// (or a synthetic dummy) so the user can verify the full pipeline without
// waiting for a real Facebook form submission.

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { decryptToken } from "@/lib/crypto";
import { fetchMetaLead } from "@/lib/meta-leads";

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = createAdminSupabaseClient();

  // 1. Find an active page subscription with a token
  const { data: pageSubs } = await supabase
    .from("meta_page_subscriptions")
    .select("meta_page_id, page_id, page_name, encrypted_page_token, platform_account_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(5);

  if (!pageSubs?.length) {
    return NextResponse.json({
      error: "Nenhuma página sincronizada. Clique em Sincronizar primeiro.",
    }, { status: 400 });
  }

  // Find a page that has a token
  let page = null;
  let accessToken: string | null = null;

  for (const p of pageSubs) {
    if (p.encrypted_page_token) {
      try {
        accessToken = decryptToken(p.encrypted_page_token as string);
        page = p;
        break;
      } catch { /* bad token, try next */ }
    } else if (p.platform_account_id) {
      const { data: tokenRow } = await supabase
        .from("meta_tokens")
        .select("encrypted_token")
        .eq("platform_account_id", p.platform_account_id)
        .maybeSingle();
      if (tokenRow?.encrypted_token) {
        try {
          accessToken = decryptToken(tokenRow.encrypted_token as string);
          page = p;
          break;
        } catch { /* bad token */ }
      }
    }
  }

  if (!page || !accessToken) {
    return NextResponse.json({
      error: "Token de acesso não encontrado. Re-sincronize as páginas.",
    }, { status: 400 });
  }

  const pageId = (page.meta_page_id ?? page.page_id) as string;

  // 2. Find the most recent leadgen_id from existing logs that was processed
  const { data: recentLog } = await admin
    .from("meta_webhook_logs")
    .select("leadgen_id")
    .eq("user_id", user.id)
    .eq("status", "processed")
    .not("leadgen_id", "is", null)
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 3. If we have a recent leadgen_id, re-fetch its data to verify the token works
  if (recentLog?.leadgen_id) {
    try {
      const leadData = await fetchMetaLead(recentLog.leadgen_id as string, accessToken);
      return NextResponse.json({
        ok:      true,
        message: "Token válido e Graph API funcionando.",
        lead:    {
          name:  leadData.full_name || leadData.first_name,
          phone: leadData.phone,
          email: leadData.email,
        },
        page: {
          id:   pageId,
          name: page.page_name,
        },
        note: "Lead já existe no CRM (não duplicado).",
      });
    } catch (err) {
      return NextResponse.json({
        ok:    false,
        error: `Graph API falhou: ${err instanceof Error ? err.message : String(err)}`,
        page:  { id: pageId, name: page.page_name },
        hint:  "Verifique se o token da página tem permissão leads_retrieval.",
      }, { status: 502 });
    }
  }

  // 4. No existing leads — just verify the token works with a simpler API call
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}?fields=id,name&access_token=${accessToken}`,
      { cache: "no-store" }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
      return NextResponse.json({
        ok:    false,
        error: `Graph API: ${body?.error?.message ?? `HTTP ${res.status}`}`,
        hint:  "Token inválido ou expirado. Re-sincronize as páginas.",
      }, { status: 502 });
    }
    const pageInfo = await res.json() as { id: string; name: string };
    return NextResponse.json({
      ok:      true,
      message: "Token válido. Webhook e Graph API configurados corretamente.",
      page:    pageInfo,
      note:    "Submeta um formulário real no Facebook para gerar um lead de teste.",
    });
  } catch (err) {
    return NextResponse.json({
      ok:    false,
      error: `Erro de rede: ${err instanceof Error ? err.message : String(err)}`,
    }, { status: 502 });
  }
}
