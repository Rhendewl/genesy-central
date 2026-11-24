import { NextRequest, NextResponse } from "next/server";
import { siteAnalyticsContext } from "@/lib/site-analytics-auth";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { verifyPixelAccess } from "@/lib/site-meta-pixel";
import { siteKeyParam } from "@/lib/site-analytics";

// Configuração do Pixel do Facebook de cada site/página do módulo Site Genesy (?site=chave). O token da API de Conversões é
// guardado criptografado e nunca volta para o navegador.
export async function PUT(req: NextRequest) {
  const context = await siteAnalyticsContext();
  if (!context) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!context.canManage) return NextResponse.json({ error: "Apenas administradores podem alterar o Pixel" }, { status: 403 });
  const body = await req.json().catch(() => null) as {
    enabled?: boolean; pixel_id?: string | null; capi_token?: string | null; remove_capi_token?: boolean; test_event_code?: string | null;
  } | null;
  if (!body) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const pixelId = String(body.pixel_id ?? "").replace(/\D/g, "");
  if (body.enabled && !/^[0-9]{6,20}$/.test(pixelId)) return NextResponse.json({ error: "Informe o ID do Pixel (somente números)." }, { status: 400 });

  const siteKey = siteKeyParam(req.nextUrl.searchParams.get("site"));
  const admin = createAdminSupabaseClient();
  const { data: current } = await admin.from("site_analytics_settings").select("id,meta_capi_token_encrypted")
    .eq("user_id", context.ownerId).eq("site_key", siteKey).maybeSingle();
  if (!current) return NextResponse.json({ error: "O site ainda não foi conectado. Abra o site uma vez e tente de novo." }, { status: 400 });

  const newToken = String(body.capi_token ?? "").trim();
  let encrypted = current.meta_capi_token_encrypted ?? null;
  if (body.remove_capi_token) encrypted = null;
  if (newToken) encrypted = encryptToken(newToken);

  // Confere o token junto do ID antes de salvar, para avisar na hora se algo estiver errado.
  let pixelName: string | null = null;
  if (encrypted && pixelId) {
    const check = await verifyPixelAccess(pixelId, newToken || decryptToken(encrypted));
    if (!check.ok) return NextResponse.json({ error: `O token não é válido ou expirou. Gere um novo no Gerenciador de Eventos. (${check.error})` }, { status: 400 });
    pixelName = check.name;
  }

  const testCode = String(body.test_event_code ?? "").trim().slice(0, 40) || null;
  const { error } = await admin.from("site_analytics_settings").update({
    meta_pixel_enabled: Boolean(body.enabled),
    meta_pixel_id: pixelId || null,
    meta_capi_token_encrypted: encrypted,
    meta_test_event_code: testCode,
    updated_at: new Date().toISOString(),
  }).eq("id", current.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, pixel_name: pixelName, has_capi_token: Boolean(encrypted) });
}
