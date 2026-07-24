export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// POST /api/formularios/[id]/imagens
// Retorna signed URL para upload direto ao Supabase Storage.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const { nome_arquivo, mime_type } = await req.json();
    if (!nome_arquivo || !mime_type) {
      return NextResponse.json({ error: "nome_arquivo e mime_type são obrigatórios." }, { status: 400 });
    }

    const acceptedMimeTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"];
    if (!acceptedMimeTypes.includes(mime_type)) {
      return NextResponse.json({ error: "Formato de imagem não suportado." }, { status: 415 });
    }

    const { data: form } = await supabase
      .from("forms")
      .select("id")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!form) return NextResponse.json({ error: "Formulário não encontrado." }, { status: 404 });

    const extensionByMime: Record<string, string> = {
      "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
      "image/svg+xml": "svg", "image/gif": "gif",
    };
    const ext = extensionByMime[mime_type];
    const storage_path = `formularios/${user.id}/${params.id}/${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage
      .from("criativos")
      .createSignedUploadUrl(storage_path);

    if (error) {
      console.error("[formularios/imagens]", error);
      return NextResponse.json({ error: "Erro ao gerar URL de upload." }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage
      .from("criativos")
      .getPublicUrl(storage_path);

    return NextResponse.json({
      signed_url: data.signedUrl,
      public_url: publicUrl,
    });
  } catch (err) {
    console.error("[formularios/imagens]", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
