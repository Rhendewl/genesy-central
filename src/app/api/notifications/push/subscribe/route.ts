// POST /api/notifications/push/subscribe
// Saves (upserts) a Web Push subscription for the authenticated user.
// Body: { subscription: PushSubscription (serialized) }

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

interface PushSubscriptionJSON {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth:   string;
  };
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as { subscription?: PushSubscriptionJSON } | null;

  const sub = body?.subscription;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ error: "Subscription inválida" }, { status: 400 });
  }

  const userAgent = req.headers.get("user-agent") ?? null;

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id:    user.id,
        endpoint:   sub.endpoint,
        p256dh:     sub.keys.p256dh,
        auth_key:   sub.keys.auth,
        user_agent: userAgent,
      },
      { onConflict: "user_id,endpoint" },
    );

  if (error) {
    console.error("[push/subscribe] upsert error:", error);
    return NextResponse.json({ error: "Erro ao salvar subscription" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/notifications/push/subscribe
// Removes a push subscription (e.g. when user opts out).
export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as { endpoint?: string } | null;
  const endpoint = body?.endpoint;
  if (!endpoint) return NextResponse.json({ error: "endpoint obrigatório" }, { status: 400 });

  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  return NextResponse.json({ ok: true });
}
