// POST /api/workspace/onboarding/tasks/[taskId]/attachments/sign
// Retorna signed URL para upload direto ao Supabase Storage (bucket dedicado
// "onboarding-documents", com RLS própria — ver 20260738_onboarding_storage.sql).
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type Params = { params: Promise<{ taskId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { taskId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as { file_name?: string; mime_type?: string } | null;
  if (!body?.file_name || !body?.mime_type) {
    return NextResponse.json({ error: "file_name e mime_type são obrigatórios" }, { status: 400 });
  }

  try {
    const { data: task } = await supabase.from("onboarding_tasks").select("project_id").eq("id", taskId).maybeSingle();
    if (!task) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });

    const ext = body.file_name.split(".").pop() ?? "bin";
    const storage_path = `onboarding/${task.project_id}/tasks/${taskId}/${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage
      .from("onboarding-documents")
      .createSignedUploadUrl(storage_path);

    if (error) throw new Error(error.message);

    const { data: { publicUrl } } = supabase.storage.from("onboarding-documents").getPublicUrl(storage_path);

    return NextResponse.json({
      signed_url:   data.signedUrl,
      public_url:   publicUrl,
      storage_path,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
