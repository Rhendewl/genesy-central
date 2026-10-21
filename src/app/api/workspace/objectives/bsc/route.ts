import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { validateBscDraft } from "@/lib/workspace/bsc-draft";
import { validateTagIds } from "@/lib/workspace/objective-validation";
export async function POST(req: NextRequest) {
  const db = await createServerSupabaseClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const error = validateBscDraft(body?.draft);
  if (
    error ||
    !validateTagIds([body?.group_id]) ||
    (body?.user_id && !validateTagIds([body.user_id]))
  )
    return NextResponse.json(
      { error: error || "Identificador inválido" },
      { status: 400 },
    );
  const r = await db.rpc("create_workspace_bsc", {
    p_group_id: body.group_id,
    p_owner_id: body.user_id || user.id,
    p_draft: body.draft,
  });
  if (r.error)
    return NextResponse.json(
      {
        error:
          r.error.code === "PGRST202"
            ? "O cadastro BSC aguarda a atualização do banco de dados. Suas respostas continuam neste formulário."
            : r.error.message,
      },
      { status: 400 },
    );
  return NextResponse.json({ objectives: r.data }, { status: 201 });
}
