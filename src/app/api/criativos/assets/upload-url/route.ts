export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// POST /api/criativos/assets/upload-url
// Retorna uma signed URL para upload direto ao Supabase Storage,
// evitando o limite de 4.5MB das API Routes da Vercel.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const body = await req.json();
    const { projeto_id, tipo, nome_arquivo, mime_type } = body;

    if (!projeto_id || !tipo || !nome_arquivo || !mime_type) {
      return NextResponse.json({ error: "Campos obrigatórios ausentes." }, { status: 400 });
    }

    const ext = nome_arquivo.split(".").pop();
    const storage_path = `${user.id}/${projeto_id}/${tipo}/${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage
      .from("criativos")
      .createSignedUploadUrl(storage_path);

    if (error) {
      console.error("[criativos/assets/upload-url]", error);
      return NextResponse.json({ error: "Erro ao gerar URL de upload." }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage
      .from("criativos")
      .getPublicUrl(storage_path);

    return NextResponse.json({
      signed_url: data.signedUrl,
      token: data.token,
      storage_path,
      public_url: publicUrl,
    });
  } catch (err) {
    console.error("[criativos/assets/upload-url]", err);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
