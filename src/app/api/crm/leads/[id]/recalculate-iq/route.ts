import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { LeadScoreEngine } from "@/lib/crm/lead-score-engine";
import type { FormStep } from "@/types";

type Params = { params: Promise<{ id: string }> };

// POST /api/crm/leads/:id/recalculate-iq
//
// Único gatilho manual de recálculo permitido pelo pedido — "jamais
// recalcular IQ de todos os leads". Sempre um lead por vez, sob demanda.
// Reaproveita a submissão vinculada (form_submissions.lead_id) + as
// perguntas ATUAIS do formulário (peso/estrelas podem ter mudado desde que
// o lead entrou) e roda o mesmo LeadScoreEngine.calculateIQ usado na
// submissão original.
export async function POST(_req: NextRequest, { params }: Params) {
  const { id: leadId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: lead } = await supabase
    .from("leads")
    .select("id, form_id")
    .eq("id", leadId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!lead) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  if (!lead.form_id) {
    return NextResponse.json({ error: "Este lead não veio de um formulário — não há o que recalcular" }, { status: 422 });
  }

  const { data: submission } = await supabase
    .from("form_submissions")
    .select("answers")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!submission) {
    return NextResponse.json({ error: "Nenhuma resposta de formulário vinculada a este lead" }, { status: 422 });
  }

  const { data: form } = await supabase
    .from("forms")
    .select("steps")
    .eq("id", lead.form_id)
    .single();

  if (!form) return NextResponse.json({ error: "Formulário não encontrado" }, { status: 404 });

  const steps    = (form.steps ?? []) as FormStep[];
  const answers  = (submission.answers ?? {}) as Record<string, unknown>;
  const iqScore  = LeadScoreEngine.calculateIQ(steps, answers);

  const { error: updateErr } = await supabase
    .from("leads")
    .update({ iq_score: iqScore })
    .eq("id", leadId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, iq_score: iqScore });
}
