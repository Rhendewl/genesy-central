import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import type { KanbanColumn, FormStep } from "@/types";

type Params = { params: Promise<{ slug: string }> };

// POST /api/form/:slug/resposta — salva ou atualiza a submissão de um visitante.
//
// Idempotente por session_id:
//   - Se não existe submissão → insere.
//   - Se existe parcial → atualiza (upgrade para completed quando solicitado).
//   - Se já está completed → retorna sem modificar (impede downgrade).
//
// Ao completar: tenta criar um lead no CRM automaticamente se houver
// uma integração CRM ativa configurada para este formulário.
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

  let submissionId: string;

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

    submissionId = existing.id;
  } else {
    // ── Primeira submissão para esta sessão — insere ─────────────────────────
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

    submissionId = submission.id;
  }

  // ── Auto-criar lead no CRM ao completar ───────────────────────────────────
  if (isCompleted) {
    void createCrmLead(supabase, session.form_id, session.user_id, body.answers, submissionId);
  }

  return NextResponse.json(
    { submission_id: submissionId },
    existing ? undefined : { status: 201 },
  );
}

// ── CRM integration ───────────────────────────────────────────────────────────

interface CrmSettings {
  source?:         string;
  kanban_column?:  KanbanColumn;
  owner_id?:       string | null;
  owner_name?:     string | null;
  tag_ids?:        string[];
  value_mode?:     "fixed" | "question";
  fixed_value?:    number;
  value_field_id?: string | null;
}

async function createCrmLead(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  formId:       string,
  userId:       string,
  answers:      Record<string, unknown>,
  submissionId: string,
): Promise<void> {
  try {
    // 1. Verificar se há integração CRM ativa
    const { data: integration } = await supabase
      .from("form_integrations")
      .select("settings, enabled")
      .eq("form_id", formId)
      .eq("adapter", "crm")
      .maybeSingle();

    if (!integration?.enabled) return;

    const settings = (integration.settings ?? {}) as CrmSettings;

    // 2. Carregar form + steps
    const { data: formData } = await supabase
      .from("forms")
      .select("name, steps")
      .eq("id", formId)
      .single();

    if (!formData) return;

    const steps    = (formData.steps ?? []) as FormStep[];
    const formName = formData.name as string;

    // 3. Extrair campos-padrão das respostas
    let leadName:   string | null = null;
    let leadPhone:  string | null = null;
    let leadEmail:  string | null = null;
    let dealValue                 = 0;
    const noteLines: string[]     = [];

    for (const step of steps) {
      const answer = answers[step.id];
      if (answer === undefined || answer === null || answer === "") continue;

      const val = Array.isArray(answer) ? answer.join(", ") : String(answer);

      if (step.type === "email" && !leadEmail) {
        leadEmail = val;
        continue;
      }
      if (step.type === "phone" && !leadPhone) {
        leadPhone = val;
        continue;
      }
      if ((step.type === "short_text" || step.type === "long_text") && !leadName && /nome/i.test(step.title)) {
        leadName = val;
        continue;
      }
      if (
        settings.value_mode !== "fixed" &&
        settings.value_field_id === step.id &&
        (step.type === "number" || step.type === "rating")
      ) {
        dealValue = Number(answer) || 0;
        continue;
      }
      noteLines.push(`${step.title}: ${val}`);
    }

    // Fallback: primeiro short_text como nome
    if (!leadName) {
      const firstText = steps.find(s => s.type === "short_text");
      if (firstText && answers[firstText.id]) leadName = String(answers[firstText.id]);
    }

    if (!leadName && !leadPhone && !leadEmail) return;

    // 4. Deduplicação
    let is_duplicate = false;
    const orParts: string[] = [];
    if (leadPhone) orParts.push(`contact.eq.${leadPhone}`);
    if (leadEmail) orParts.push(`email.eq.${leadEmail}`);
    if (orParts.length) {
      const { data: dupe } = await supabase
        .from("leads")
        .select("id")
        .eq("user_id", userId)
        .or(orParts.join(","))
        .maybeSingle();
      if (dupe) is_duplicate = true;
    }

    // 5. Montar notes
    const metaLines: string[] = [`Formulário: ${formName}`];
    if (settings.owner_name) metaLines.push(`Responsável: ${settings.owner_name}`);
    const noteSections: string[] = [metaLines.join("\n")];
    if (noteLines.length) noteSections.push(noteLines.join("\n"));
    const notes = noteSections.join("\n\n") || null;

    // 6. Criar lead
    const { data: createdLead } = await supabase
      .from("leads")
      .insert({
        user_id:       userId,
        name:          leadName ?? "Sem nome",
        contact:       leadPhone ?? leadEmail ?? "",
        email:         leadEmail ?? null,
        source:        settings.source ?? "formulario_genesy",
        form_id:       formId,
        form_name:     formName,
        kanban_column: settings.kanban_column ?? "novo_lead",
        tags:          settings.tag_ids ?? [],
        deal_value:    settings.value_mode === "fixed" ? (settings.fixed_value ?? 0) : dealValue,
        notes,
        entered_at:    new Date().toISOString().split("T")[0],
        is_duplicate,
      })
      .select("id")
      .single();

    // 7. Linkar lead à submissão
    if (createdLead?.id) {
      await supabase
        .from("form_submissions")
        .update({ lead_id: createdLead.id })
        .eq("id", submissionId);
    }
  } catch (err) {
    console.error("[resposta/crm] Falha ao criar lead:", err);
  }
}
