import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { FormStep, LogicRule, FormEnding } from "@/types";

type Params = { params: Promise<{ id: string }> };

// Valida invariantes de publicação por bloco. Cada novo tipo de bloco que
// precise de uma pré-condição própria para publicar entra aqui, sem tocar
// no restante do fluxo de publicação.
function validatePublish(steps: FormStep[], logicRules: LogicRule[], endings: FormEnding[]): string | null {
  if (steps.length === 0) {
    return "O formulário precisa ter ao menos uma pergunta para ser publicado";
  }
  for (const step of steps) {
    if (step.type === "calendar" && !step.calendarId) {
      return "O bloco Calendário precisa de um calendário selecionado antes de publicar";
    }
  }

  const stepIds   = new Set(steps.map(s => s.id));
  const endingIds = new Set(endings.map(e => e.id));
  for (const rule of logicRules) {
    if (!rule.action.target) continue;
    const targetExists = rule.action.type === "jump"
      ? stepIds.has(rule.action.target)
      : endingIds.has(rule.action.target);
    if (!targetExists) {
      return "Uma regra de lógica aponta para uma pergunta ou tela que não existe mais — corrija ou remova a regra antes de publicar";
    }
  }
  return null;
}

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

  const validationError = validatePublish(
    (form.steps ?? []) as FormStep[],
    (form.logic_rules ?? []) as LogicRule[],
    (form.endings ?? []) as FormEnding[],
  );
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 422 });
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
