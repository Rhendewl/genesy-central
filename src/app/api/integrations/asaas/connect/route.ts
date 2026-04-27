export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { encryptToken } from "@/lib/crypto";
import { validateAsaasKey, type AsaasEnv } from "@/lib/asaas-api";

// POST /api/integrations/asaas/connect
// Body: { apiKey: string; environment: "sandbox" | "production" }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { apiKey?: string; environment?: string };
    const { apiKey, environment } = body;

    if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 10) {
      return NextResponse.json({ error: "API Key inválida." }, { status: 400 });
    }
    if (environment !== "sandbox" && environment !== "production") {
      return NextResponse.json({ error: "Ambiente inválido." }, { status: 400 });
    }

    const env = environment as AsaasEnv;

    // ── Authenticate user ─────────────────────────────────────────────────────
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    // ── Validate key against Asaas ────────────────────────────────────────────
    console.log(`[asaas/connect] validating key for user=${user.id} env=${env}`);
    const validation = await validateAsaasKey(apiKey.trim(), env);
    if (!validation.valid) {
      console.warn(`[asaas/connect] validation failed: ${validation.message}`);
      return NextResponse.json({ error: validation.message }, { status: 422 });
    }
    console.log(`[asaas/connect] key valid — accountId=${validation.account.id}`);

    const { account } = validation;

    // ── Persist (upsert) to integrations table ────────────────────────────────
    const { error: dbErr } = await supabase
      .from("integrations")
      .upsert(
        {
          user_id:           user.id,
          provider:          "asaas",
          api_key_encrypted: encryptToken(apiKey.trim()),
          environment:       env,
          status:            "connected",
          last_sync_at:      new Date().toISOString(),
          metadata: {
            accountId:   account.id,
            accountName: account.name,
            email:       account.loginEmail ?? account.email,
            walletId:    account.walletId ?? null,
          },
        },
        { onConflict: "user_id,provider" },
      );

    if (dbErr) {
      console.error("[asaas/connect] db upsert error:", dbErr);
      return NextResponse.json({ error: "Erro ao salvar integração." }, { status: 500 });
    }

    return NextResponse.json({
      success:     true,
      environment: env,
      accountName: account.name,
      accountId:   account.id,
    });
  } catch (err) {
    console.error("[asaas/connect]", err);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
