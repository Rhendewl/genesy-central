// POST /api/workspace/objectives/[id]/attachments/sign
// Retorna signed URL para upload direto ao Supabase Storage (bucket "criativos").
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id: objectiveId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as { file_name?: string; mime_type?: string } | null;
  if (!body?.file_name || !body?.mime_type) {
    return NextResponse.json({ error: "file_name e mime_type são obrigatórios" }, { status: 400 });
  }

  try {
    const ext = body.file_name.split(".").pop() ?? "bin";
    const storage_path = `workspace-objectives/${user.id}/${objectiveId}/${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage.from("criativos").createSignedUploadUrl(storage_path);
    if (error) throw new Error(error.message);

    const { data: { publicUrl } } = supabase.storage.from("criativos").getPublicUrl(storage_path);

    return NextResponse.json({ signed_url: data.signedUrl, public_url: publicUrl, storage_path });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
