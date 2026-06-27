import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { buildInsightsDomain } from "@/lib/analytics/domain";
import type { RawInsightsData, RawStepDefinition } from "@/lib/analytics/types";

type Params = { params: Promise<{ id: string }> };

// GET /api/formularios/:id/insights — analytics completos do formulário
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Confirma propriedade
  const { data: form } = await supabase
    .from("forms")
    .select("id, steps")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!form) return NextResponse.json({ error: "Formulário não encontrado" }, { status: 404 });

  // Busca todos os dados brutos em paralelo
  const [eventsRes, submissionsRes, sessionsRes] = await Promise.all([
    supabase
      .from("form_events")
      .select("event, step_id, duration, meta, created_at")
      .eq("form_id", id)
      .order("created_at", { ascending: true }),

    supabase
      .from("form_submissions")
      .select("status, score, created_at")
      .eq("form_id", id)
      .order("created_at", { ascending: true }),

    supabase
      .from("form_sessions")
      .select("device, browser, os, language, country, city, utm_source, utm_medium, utm_campaign, utm_term, utm_content, referrer, steps_completed, is_partial, started_at, finished_at, abandoned_at")
      .eq("form_id", id)
      .order("started_at", { ascending: true }),
  ]);

  const rawSteps = (form.steps as Array<{ id: string; title: string; type?: string }>) ?? [];
  const steps: RawStepDefinition[] = rawSteps.map(s => ({
    id:    s.id,
    title: s.title ?? "",
    type:  s.type,
  }));

  const rawData: RawInsightsData = {
    events:      eventsRes.data      ?? [],
    submissions: submissionsRes.data ?? [],
    sessions:    sessionsRes.data    ?? [],
    steps,
  };

  const insights = buildInsightsDomain(rawData, 30);

  return NextResponse.json({ insights });
}
