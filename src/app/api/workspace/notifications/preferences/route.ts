// GET   /api/workspace/notifications/preferences — busca (ou cria com defaults) as
//       preferências de notificação de tarefas do usuário logado
// PATCH /api/workspace/notifications/preferences — atualiza campos

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { TaskNotificationPreferences, UpdateTaskNotificationPreferences } from "@/types/workspace-notifications";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const { data: existing, error: fetchError } = await supabase
      .from("workspace_task_notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);
    if (existing) return NextResponse.json({ preferences: existing as TaskNotificationPreferences });

    const { data: created, error: insertError } = await supabase
      .from("workspace_task_notification_preferences")
      .insert({ user_id: user.id })
      .select("*")
      .single();

    if (insertError) throw new Error(insertError.message);
    return NextResponse.json({ preferences: created as TaskNotificationPreferences });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as UpdateTaskNotificationPreferences | null;
  if (!body) return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const key of [
    "notify_on_assignment", "notify_on_status_change", "notify_on_completion",
    "notify_deadline_reminder", "reminder_time", "reminder_advance_days",
  ] as const) {
    if (key in body) patch[key] = body[key];
  }

  try {
    const { data, error } = await supabase
      .from("workspace_task_notification_preferences")
      .upsert({ user_id: user.id, ...patch }, { onConflict: "user_id" })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ preferences: data as TaskNotificationPreferences });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
