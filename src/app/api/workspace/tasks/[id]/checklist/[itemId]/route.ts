// PATCH  /api/workspace/tasks/[id]/checklist/[itemId] — atualiza label/is_completed
// DELETE /api/workspace/tasks/[id]/checklist/[itemId] — remove item

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { verifyWorkspaceTaskCreator, verifyWorkspaceTaskExecutor } from "@/lib/workspace/task-authorization";
import type { WorkspaceTaskChecklistItem } from "@/types/workspace";

type Params = { params: Promise<{ id: string; itemId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, itemId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as { label?: string; is_completed?: boolean } | null;
  if (!body) return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.label === "string") patch.label = body.label;
  if (typeof body.is_completed === "boolean") patch.is_completed = body.is_completed;

  try {
    const changesLabel = typeof body.label === "string";
    const access = changesLabel
      ? await verifyWorkspaceTaskCreator(supabase, id, user.id)
      : await verifyWorkspaceTaskExecutor(supabase, id, user.id);
    if (!access.allowed) return NextResponse.json({ error: access.error }, { status: access.status });

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nenhuma alteração válida informada" }, { status: 400 });
    }

    // A RLS continua creator-only para impedir edição direta dos demais
    // campos. O servidor eleva apenas esta mutação, depois da autorização.
    const { data, error } = await createAdminSupabaseClient()
      .from("workspace_task_checklist_items")
      .update(patch)
      .eq("id", itemId)
      .eq("task_id", id)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ item: data as WorkspaceTaskChecklistItem });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, itemId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const access = await verifyWorkspaceTaskCreator(supabase, id, user.id);
    if (!access.allowed) return NextResponse.json({ error: access.error }, { status: access.status });

    const { error } = await supabase.from("workspace_task_checklist_items").delete().eq("id", itemId).eq("task_id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
