// DELETE /api/workspace/tasks/[id]/comments/[commentId]

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { verifyWorkspaceTaskCreator } from "@/lib/workspace/task-authorization";

type Params = { params: Promise<{ id: string; commentId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, commentId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const access = await verifyWorkspaceTaskCreator(supabase, id, user.id);
    if (!access.allowed) return NextResponse.json({ error: access.error }, { status: access.status });

    const { error } = await supabase.from("workspace_task_comments").delete().eq("id", commentId).eq("task_id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
