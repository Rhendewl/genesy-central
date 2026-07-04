// PUT    /api/crm/notification-rules/[id] — update rule
// DELETE /api/crm/notification-rules/[id] — delete rule

import { NextRequest, NextResponse }   from "next/server";
import { createServerSupabaseClient }  from "@/lib/supabase-server";
import type { UpdateCrmNotificationRule } from "@/types/crm";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const { id }   = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as UpdateCrmNotificationRule;

  const allowed: (keyof UpdateCrmNotificationRule)[] = ["enabled", "channels", "title", "body"];
  const payload: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) payload[key] = body[key];
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
  }

  const { error } = await supabase
    .from("crm_notification_rules")
    .update(payload)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("[notification-rules] PUT error:", error);
    return NextResponse.json({ error: "Erro ao atualizar regra" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id }   = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { error } = await supabase
    .from("crm_notification_rules")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("[notification-rules] DELETE error:", error);
    return NextResponse.json({ error: "Erro ao remover regra" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
