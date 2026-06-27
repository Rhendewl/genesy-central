import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

type Params = { params: Promise<{ slug: string }> };

// POST /api/form/:slug/resposta — salva ou atualiza a submissão de um visitante.
//
// Idempotente por session_id:
//   - Se não existe submissão → insere.
//   - Se existe parcial → atualiza (upgrade para completed quando solicitado).
//   - Se já está completed → retorna sem modificar (impede downgrade).
//
// Aceita sendBeacon (partial) e POST normal (completed).
// Usa admin client — autenticado pelo token da sessão, não pelo usuário dono.
export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const supabase = createAdminSupabaseClient();

  const body = await req.json().catch(() => null) as {
    session_token: string;
    answers: Record<string, unknown>;
    status?: "partial" | "completed";
  } | null;

  if (!body?.session_token || !body?.answers) {
    return NextResponse.json({ error: "session_token e answers são obrigatórios" }, { status: 400 });
  }

  // Valida o token e obtém os IDs da sessão
  const { data: session } = await supabase
    .from("form_sessions")
    .select("id, form_id, user_id")
    .eq("token", body.session_token)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  }

  // Confirma que a sessão pertence ao formulário correto
  const { data: form } = await supabase
    .from("forms")
    .select("id")
    .eq("id", session.form_id)
    .eq("slug", slug)
    .single();

  if (!form) {
    return NextResponse.json({ error: "Formulário inválido para esta sessão" }, { status: 403 });
  }

  const now         = new Date().toISOString();
  const isCompleted = body.status !== "partial";

  // ── Idempotência: verifica submissão existente para esta sessão ────────────
  const { data: existing } = await supabase
    .from("form_submissions")
    .select("id, status")
    .eq("session_id", session.id)
    .maybeSingle();

  if (existing) {
    // Já está completed — não faz downgrade
    if (existing.status === "completed") {
      return NextResponse.json({ submission_id: existing.id });
    }

    // Atualiza: partial → completed (ou partial → partial com novas respostas)
    const { error: updateErr } = await supabase
      .from("form_submissions")
      .update({
        status:       isCompleted ? "completed" : "partial",
        answers:      body.answers,
        completed_at: isCompleted ? now : null,
      })
      .eq("id", existing.id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    await supabase
      .from("form_sessions")
      .update({
        is_partial:  !isCompleted,
        finished_at: isCompleted ? now : null,
      })
      .eq("id", session.id);

    return NextResponse.json({ submission_id: existing.id });
  }

  // ── Primeira submissão para esta sessão — insere ───────────────────────────
  const { data: submission, error: insertErr } = await supabase
    .from("form_submissions")
    .insert({
      form_id:      session.form_id,
      user_id:      session.user_id,
      session_id:   session.id,
      status:       isCompleted ? "completed" : "partial",
      answers:      body.answers,
      completed_at: isCompleted ? now : null,
    })
    .select("id")
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  await supabase
    .from("form_sessions")
    .update({
      is_partial:  !isCompleted,
      finished_at: isCompleted ? now : null,
    })
    .eq("id", session.id);

  return NextResponse.json({ submission_id: submission.id }, { status: 201 });
}
