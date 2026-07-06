// POST /api/workspace/objectives/[id]/attachments
// Registra a linha do anexo depois que o upload direto ao storage foi concluído.

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { WorkspaceObjectiveAttachment } from "@/types/workspace-objectives";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id: objectiveId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    file_name?: string; mime_type?: string; file_size?: number;
    storage_path?: string; public_url?: string;
  } | null;

  if (!body?.file_name || !body?.mime_type || !body?.storage_path || !body?.public_url) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from("workspace_objective_attachments")
      .insert({
        objective_id: objectiveId,
        file_name:    body.file_name,
        mime_type:    body.mime_type,
        file_size:    body.file_size ?? null,
        storage_path: body.storage_path,
        public_url:   body.public_url,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ attachment: data as WorkspaceObjectiveAttachment }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
