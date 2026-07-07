import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { LeadService } from "@/lib/crm/lead-service";
import { LeadScoreEngine } from "@/lib/crm/lead-score-engine";
import { extractContactFromAnswers } from "@/lib/forms/extract-contact";
import type { FormStep } from "@/types";

type Params = { params: Promise<{ slug: string }> };

// POST /api/form/:slug/resposta — salva ou atualiza a submissão de um visitante.
//
// Idempotente por session_id:
//   - Se não existe submissão → insere.
//   - Se existe parcial → atualiza (upgrade para completed quando solicitado).
//   - Se já está completed → retorna sem modificar (impede downgrade).
//
// Tenta criar (ou atualizar) um lead no CRM automaticamente sempre que houver
// uma integração CRM ativa configurada para este formulário — mesmo em
// respostas parciais (abandono), contanto que já haja nome/telefone/e-mail
// suficiente para identificar o contato. Ver createCrmLead().
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

  // ── Auto-criar (ou atualizar) lead no CRM — mesmo em respostas parciais ───
  // Quem abandona o formulário no meio já deixou um contato identificável
  // (nome/telefone/e-mail); o lead é criado assim que houver dado suficiente,
  // sem esperar a conclusão. Se a pessoa completar depois, o mesmo lead é
  // atualizado em vez de duplicado — ver createCrmLead().
  void createCrmLead(supabase, session.form_id, session.user_id, body.answers, submissionId);

  return NextResponse.json(
    { submission_id: submissionId },
    existing ? undefined : { status: 201 },
  );
}

// ── CRM integration ───────────────────────────────────────────────────────────

interface CrmSettings {
  source?:         string;
  pipeline_id?:    string | null;
  stage_id?:       string | null;
  kanban_column?:  string;        // read-only: backward compat with legacy configs
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

    // Requer pipeline_id + stage_id (novo fluxo) ou kanban_column (legado)
    const hasNewConfig = !!settings.pipeline_id && !!settings.stage_id;
    const hasLegacy    = !!settings.kanban_column;
    if (!hasNewConfig && !hasLegacy) return;

    // 2. Carregar form + steps
    const { data: formData } = await supabase
      .from("forms")
      .select("name, steps")
      .eq("id", formId)
      .single();

    if (!formData) return;

    const steps    = (formData.steps ?? []) as FormStep[];
    const formName = formData.name as string;

    // 3. Extrair campos-padrão das respostas (nome/telefone/e-mail — lógica
    // compartilhada com o bloco Calendário, que também precisa desses dados
    // sem pedir de novo) + montar dealValue/notas com o restante das respostas.
    const { name: leadName, phone: leadPhone, email: leadEmail, consumedStepIds } =
      extractContactFromAnswers(steps, answers);
    const consumedSet = new Set(consumedStepIds);

    let dealValue              = 0;
    const noteLines: string[] = [];

    for (const step of steps) {
      const answer = answers[step.id];
      if (answer === undefined || answer === null || answer === "") continue;
      if (consumedSet.has(step.id)) continue;

      const val = Array.isArray(answer) ? answer.join(", ") : String(answer);

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

    if (!leadName && !leadPhone && !leadEmail) return;

    // IQ (Inteligência de Qualificação) — calculado a partir do snapshot
    // atual de steps+answers (ver LeadScoreEngine). Recalculado a cada save
    // (parcial ou completo) desta mesma submissão: como respostas só se
    // acumulam, o valor estabiliza no da submissão completa, sem precisar de
    // um passo especial de "congelamento".
    const iqScore = LeadScoreEngine.calculateIQ(steps, answers);

    // 4. Montar notes
    const metaLines: string[] = [`Formulário: ${formName}`];
    if (settings.owner_name) metaLines.push(`Responsável: ${settings.owner_name}`);
    const noteSections: string[] = [metaLines.join("\n")];
    if (noteLines.length) noteSections.push(noteLines.join("\n"));
    const notes = noteSections.join("\n\n") || null;

    // 5. Essa submissão já gerou um lead antes (ex.: resposta parcial que já
    // tinha nome/telefone/e-mail)? Atualiza o mesmo lead em vez de duplicar —
    // não move de etapa/pipeline, só atualiza os dados de contato/notas.
    const { data: existingSubmission } = await supabase
      .from("form_submissions")
      .select("lead_id")
      .eq("id", submissionId)
      .single();

    if (existingSubmission?.lead_id) {
      await supabase
        .from("leads")
        .update({
          name:       leadName ?? "Sem nome",
          contact:    leadPhone ?? leadEmail ?? "",
          email:      leadEmail ?? null,
          tags:       settings.tag_ids ?? [],
          deal_value: settings.value_mode === "fixed" ? (settings.fixed_value ?? 0) : dealValue,
          notes,
          iq_score:   iqScore,
        })
        .eq("id", existingSubmission.lead_id);
      return;
    }

    // 6. Deduplicação (só para leads novos)
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

    const commonFields = {
      user_id:     userId,
      name:        leadName ?? "Sem nome",
      contact:     leadPhone ?? leadEmail ?? "",
      email:       leadEmail ?? null,
      source:      settings.source ?? "formulario_genesy",
      form_id:     formId,
      form_name:   formName,
      // Coluna estruturada, fonte de verdade a partir de agora — o texto em
      // "notes" acima é só compatibilidade visual (mostra o nome mesmo se o
      // responsável for removido da equipe depois).
      assigned_to: settings.owner_id ?? null,
      tags:        settings.tag_ids ?? [],
      deal_value:  settings.value_mode === "fixed" ? (settings.fixed_value ?? 0) : dealValue,
      notes,
      entered_at:  new Date().toISOString().split("T")[0],
      is_duplicate,
      iq_score:    iqScore,
    };

    let createdLeadId: string | null = null;

    if (hasNewConfig) {
      // ── Novo fluxo: via LeadService (pipeline_id + stage_id) ──────────────
      // Publica lead.stage.entered → aciona conversion engine + histórico de etapa
      const service = new LeadService(supabase);
      const result  = await service.createLead({
        ...commonFields,
        stageId: settings.stage_id!,
      });
      if (result.ok) {
        createdLeadId = result.leadId;
      } else {
        console.error("[resposta/crm] LeadService.createLead falhou:", result.error);
      }
    } else {
      // ── Legado: kanban_column — configs sem pipeline_id/stage_id ──────────
      const { data: createdLead } = await supabase
        .from("leads")
        .insert({ ...commonFields, kanban_column: settings.kanban_column ?? "novo_lead" })
        .select("id")
        .single();
      if (createdLead?.id) createdLeadId = createdLead.id;
    }

    // 7. Linkar lead à submissão
    if (createdLeadId) {
      await supabase
        .from("form_submissions")
        .update({ lead_id: createdLeadId })
        .eq("id", submissionId);
    }
  } catch (err) {
    console.error("[resposta/crm] Falha ao criar lead:", err);
  }
}
