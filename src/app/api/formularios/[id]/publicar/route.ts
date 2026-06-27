import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type Params = { params: Promise<{ id: string }> };

// POST /api/formularios/:id/publicar
// Publica o formulário: muda status para 'published', grava snapshot versionado.
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Carrega o formulário completo
  const { data: form, error: fetchErr } = await supabase
    .from("forms")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (fetchErr || !form) {
    return NextResponse.json({ error: "Formulário não encontrado" }, { status: 404 });
  }

  if (!form.steps || (form.steps as unknown[]).length === 0) {
    return NextResponse.json({ error: "O formulário precisa ter ao menos uma pergunta para ser publicado" }, { status: 422 });
  }

  // Determina o próximo número de versão
  const { data: lastVersion } = await supabase
    .from("form_versions")
    .select("version")
    .eq("form_id", id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (lastVersion?.version ?? 0) + 1;
  const now = new Date().toISOString();

  // Snapshot da versão publicada
  const snapshot = {
    steps: form.steps,
    logic_rules: form.logic_rules,
    welcome_screen: form.welcome_screen,
    endings: form.endings,
    theme: form.theme,
    settings: form.settings,
  };

  // Insere a versão e atualiza o status — sequencialmente (sem transação nativa no JS)
  const { error: versionErr } = await supabase
    .from("form_versions")
    .insert({ form_id: id, user_id: user.id, version: nextVersion, snapshot, published_at: now });

  if (versionErr) return NextResponse.json({ error: versionErr.message }, { status: 500 });

  const { error: updateErr } = await supabase
    .from("forms")
    .update({ status: "published", published_at: now, updated_by: user.id })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, version: nextVersion, published_at: now });
}
