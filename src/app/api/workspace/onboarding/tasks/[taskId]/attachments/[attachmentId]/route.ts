// DELETE /api/workspace/onboarding/tasks/[taskId]/attachments/[attachmentId]

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type Params = { params: Promise<{ taskId: string; attachmentId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { attachmentId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const { data: attachment } = await supabase
      .from("onboarding_task_attachments")
      .select("storage_path")
      .eq("id", attachmentId)
      .maybeSingle();

    if (attachment) {
      await supabase.storage.from("onboarding-documents").remove([attachment.storage_path]);
    }

    const { error } = await supabase.from("onboarding_task_attachments").delete().eq("id", attachmentId);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
