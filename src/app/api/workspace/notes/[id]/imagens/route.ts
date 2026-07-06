// POST /api/workspace/notes/[id]/imagens
// Retorna signed URL para upload direto ao Supabase Storage (bucket "criativos",
// mesmo padrão de src/app/api/formularios/[id]/imagens/route.ts). Usada tanto
// para a capa da nota quanto para imagens/anexos inline no editor.
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id: noteId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as { nome_arquivo?: string; mime_type?: string } | null;
  if (!body?.nome_arquivo || !body?.mime_type) {
    return NextResponse.json({ error: "nome_arquivo e mime_type são obrigatórios" }, { status: 400 });
  }

  try {
    const ext = body.nome_arquivo.split(".").pop() ?? "bin";
    const storage_path = `workspace-notes/${user.id}/${noteId}/${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage.from("criativos").createSignedUploadUrl(storage_path);
    if (error) throw new Error(error.message);

    const { data: { publicUrl } } = supabase.storage.from("criativos").getPublicUrl(storage_path);

    return NextResponse.json({ signed_url: data.signedUrl, public_url: publicUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
