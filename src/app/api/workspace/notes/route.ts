// GET  /api/workspace/notes — lista notas (colunas de resumo, sem content)
// POST /api/workspace/notes — cria nota vazia, retorna a linha completa

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { WorkspaceNote, WorkspaceNoteSummary } from "@/types/workspace-notes";

const SUMMARY_COLUMNS = "id,title,cover_url,color,tags,created_at,updated_at";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const url         = new URL(req.url);
  const search      = url.searchParams.get("search") ?? undefined;
  // De quem é este Workspace — o próprio por padrão, ou um colega sendo
  // visualizado via Painel Equipe (a RLS decide se isso é permitido).
  const targetUserId = url.searchParams.get("as_user_id") || user.id;

  try {
    let query = supabase.from("workspace_notes").select(SUMMARY_COLUMNS).eq("user_id", targetUserId).order("updated_at", { ascending: false });
    if (search) query = query.ilike("title", `%${search}%`);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ notes: (data ?? []) as WorkspaceNoteSummary[] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { title?: string; user_id?: string } | null;

  try {
    const { data, error } = await supabase
      .from("workspace_notes")
      .insert({
        // user_id só enviado quando o admin cria "em nome de" um colega —
        // RLS (is_admin_of_user) valida; sem isso o trigger usa o próprio uid.
        ...(body?.user_id ? { user_id: body.user_id } : {}),
        created_by: user.id,
        ...(body?.title ? { title: body.title } : {}),
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ note: data as WorkspaceNote }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
