// GET /api/meta/forms?pageId=xxx
// Lists lead gen forms for a Facebook page, merging with subscription state.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { decryptToken } from "@/lib/crypto";
import { getLeadGenForms } from "@/lib/meta-api";

export async function GET(req: NextRequest) {
  const pageId = req.nextUrl.searchParams.get("pageId");
  if (!pageId) return NextResponse.json({ error: "pageId required" }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Resolve token: prefer page token, fall back to user token
  const { data: pageSub } = await supabase
    .from("meta_page_subscriptions")
    .select("encrypted_page_token, platform_account_id")
    .eq("user_id", user.id)
    .eq("meta_page_id", pageId)
    .maybeSingle();

  if (!pageSub) {
    return NextResponse.json({ error: "Página não encontrada" }, { status: 404 });
  }

  let token: string;
  if (pageSub.encrypted_page_token) {
    token = decryptToken(pageSub.encrypted_page_token as string);
  } else if (pageSub.platform_account_id) {
    const { data: tokenRow } = await supabase
      .from("meta_tokens")
      .select("encrypted_token")
      .eq("platform_account_id", pageSub.platform_account_id)
      .maybeSingle();
    if (!tokenRow?.encrypted_token) {
      return NextResponse.json({ error: "Token não encontrado — sincronize as páginas" }, { status: 404 });
    }
    token = decryptToken(tokenRow.encrypted_token as string);
  } else {
    return NextResponse.json({ error: "Token não disponível" }, { status: 404 });
  }

  // Fetch forms from Meta API
  let forms;
  try {
    forms = await getLeadGenForms(pageId, token);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // Merge with subscription state
  const { data: subs } = await supabase
    .from("meta_form_subscriptions")
    .select("form_id, is_active, leads_count, last_lead_at")
    .eq("user_id", user.id)
    .eq("page_id", pageId);

  const subMap = new Map((subs ?? []).map(s => [
    s.form_id as string,
    s as { form_id: string; is_active: boolean; leads_count: number; last_lead_at: string | null },
  ]));

  const formsWithState = forms.map(f => ({
    ...f,
    is_subscribed: subMap.get(f.id)?.is_active ?? false,
    leads_count:   subMap.get(f.id)?.leads_count ?? 0,
    last_lead_at:  subMap.get(f.id)?.last_lead_at ?? null,
  }));

  return NextResponse.json({ forms: formsWithState });
}
