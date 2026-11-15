import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
export async function POST(req: NextRequest) {
  const db = await createServerSupabaseClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  try {
    const data = await req.formData();
    const file = data.get("file");
    if (!(file instanceof File) || file.size > 2 * 1024 * 1024)
      throw new Error("Selecione um Word (.docx) ou texto (.txt) de até 2 MB");
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = file.name.toLowerCase().endsWith(".docx")
      ? (await mammoth.extractRawText({ buffer })).value
      : file.name.toLowerCase().endsWith(".txt")
        ? buffer.toString("utf8")
        : null;
    if (!text?.trim() || text.length > 150000)
      throw new Error(
        "Modelo inválido. Use .docx ou .txt com até 150 mil caracteres",
      );
    return NextResponse.json({ text: text.trim() });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Não foi possível ler o modelo",
      },
      { status: 400 },
    );
  }
}
