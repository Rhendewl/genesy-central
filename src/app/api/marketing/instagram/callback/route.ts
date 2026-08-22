import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { encryptToken, verifyState } from "@/lib/crypto";
import {
  exchangeInstagramCode, exchangeInstagramLongLivedToken, getInstagramProfile,
  INSTAGRAM_AUTOMATION_SCOPES, INSTAGRAM_AUTOMATION_WEBHOOK_FIELDS, subscribeInstagramWebhooks,
} from "@/lib/instagram-api";
import { getMarketingServerContext } from "@/lib/marketing/server";

export const dynamic = "force-dynamic";

type InstagramState = Record<string, unknown> & { userId: string; organizationId: string };

function redirectWith(req: NextRequest, key: string, value: string) {
  const url = new URL("/marketing/relatorios", req.nextUrl.origin);
  url.searchParams.set("view", "instagram");
  url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code");
    const stateParam = req.nextUrl.searchParams.get("state");
    if (!code || !stateParam || req.nextUrl.searchParams.get("error")) {
      return redirectWith(req, "instagram_error", "authorization_denied");
    }

    const state = verifyState<InstagramState>(stateParam);
    const supabase = await createServerSupabaseClient();
    const context = await getMarketingServerContext(supabase);
    if (!context.isAdmin || context.user.id !== state.userId || context.organizationId !== state.organizationId) {
      return redirectWith(req, "instagram_error", "invalid_session");
    }

    const redirectUri = `${req.nextUrl.origin}/api/marketing/instagram/callback`;
    const short = await exchangeInstagramCode(code, redirectUri);
    let accessToken = short.access_token!;
    let expiresAt: string | null = null;
    try {
      const longLived = await exchangeInstagramLongLivedToken(accessToken);
      accessToken = longLived.access_token;
      expiresAt = longLived.expires_in
        ? new Date(Date.now() + longLived.expires_in * 1000).toISOString()
        : null;
    } catch (error) {
      console.warn("[instagram/callback] long-lived token unavailable", error);
    }

    const profile = await getInstagramProfile(accessToken);
    const instagramUserId = String(profile.user_id ?? profile.id ?? short.user_id ?? "");
    if (!instagramUserId || !profile.username) throw new Error("Perfil profissional do Instagram não encontrado");
    const now = new Date().toISOString();
    let webhookSubscribed = false;
    let webhookError: string | null = null;
    try {
      const subscription = await subscribeInstagramWebhooks(instagramUserId, accessToken);
      webhookSubscribed = subscription.success === true;
      if (!webhookSubscribed) webhookError = "A Meta não confirmou a assinatura dos webhooks";
    } catch (error) {
      webhookError = error instanceof Error ? error.message.slice(0, 500) : "Falha ao assinar webhooks";
      console.warn("[instagram/callback] webhook subscription unavailable", error);
    }
    const { error } = await supabase.from("marketing_instagram_connections").upsert({
      organization_id: context.organizationId,
      connected_by: context.user.id,
      instagram_user_id: instagramUserId,
      username: profile.username,
      display_name: profile.name ?? null,
      profile_picture_url: profile.profile_picture_url ?? null,
      followers_count: profile.followers_count ?? 0,
      media_count: profile.media_count ?? 0,
      encrypted_access_token: encryptToken(accessToken),
      token_expires_at: expiresAt,
      requested_scopes: [...INSTAGRAM_AUTOMATION_SCOPES],
      webhook_subscribed: webhookSubscribed,
      webhook_fields: webhookSubscribed ? [...INSTAGRAM_AUTOMATION_WEBHOOK_FIELDS] : [],
      webhook_error: webhookError,
      status: "connected",
      sync_error: null,
      updated_at: now,
    }, { onConflict: "organization_id,instagram_user_id" });
    if (error) throw new Error(error.message);

    return redirectWith(req, "instagram_connected", "1");
  } catch (error) {
    console.error("[instagram/callback]", error);
    return redirectWith(req, "instagram_error", "connection_failed");
  }
}
