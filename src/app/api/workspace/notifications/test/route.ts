import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { dispatchPushToUser } from "@/lib/notifications/push-dispatcher";

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!process.env.VAPID_SUBJECT || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: "Chaves VAPID não configuradas no ambiente." }, { status: 500 });
  }

  const result = await dispatchPushToUser(
    supabase,
    user.id,
    "Teste de notificação",
    "Se você recebeu este aviso, as notificações de tarefas estão funcionando neste dispositivo.",
    { tag: `genesy-push-test-${Date.now()}`, url: "/workspace/configuracoes/notificacoes" },
  );

  if (result.skippedReason === "no_subscriptions") {
    return NextResponse.json({ error: "Nenhum dispositivo está inscrito para receber notificações." }, { status: 409 });
  }
  if (result.skippedReason === "vapid_not_configured") {
    return NextResponse.json({ error: "Chaves VAPID não configuradas no ambiente." }, { status: 500 });
  }
  if (result.accepted === 0) {
    return NextResponse.json({ error: "O provedor recusou a entrega da notificação.", delivery: result }, { status: 502 });
  }

  return NextResponse.json({ ok: true, delivery: result });
}
