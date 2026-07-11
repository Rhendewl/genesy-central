// GET  /api/workspace/onboarding/templates — lista templates (admin-only via RLS)
// POST /api/workspace/onboarding/templates — cria template vazio

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { NewOnboardingTemplate, OnboardingTemplate } from "@/types/onboarding";

export async function GET(_req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const { data, error } = await supabase
      .from("onboarding_templates")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const templateIds = (data ?? []).map((t) => t.id);
    const { data: stages } = templateIds.length > 0
      ? await supabase.from("onboarding_template_stages").select("id, template_id").in("template_id", templateIds)
      : { data: [] as { id: string; template_id: string }[] };

    const stageIds = (stages ?? []).map((s) => s.id);
    const { data: tasks } = stageIds.length > 0
      ? await supabase.from("onboarding_template_tasks").select("id, stage_id").in("stage_id", stageIds)
      : { data: [] as { id: string; stage_id: string }[] };

    const stagesByTemplate = new Map<string, number>();
    const stageToTemplate = new Map<string, string>();
    for (const s of stages ?? []) {
      stagesByTemplate.set(s.template_id, (stagesByTemplate.get(s.template_id) ?? 0) + 1);
      stageToTemplate.set(s.id, s.template_id);
    }

    const tasksByTemplate = new Map<string, number>();
    for (const t of tasks ?? []) {
      const templateId = stageToTemplate.get(t.stage_id);
      if (!templateId) continue;
      tasksByTemplate.set(templateId, (tasksByTemplate.get(templateId) ?? 0) + 1);
    }

    const templates = ((data ?? []) as OnboardingTemplate[]).map((t) => ({
      ...t,
      stage_count: stagesByTemplate.get(t.id) ?? 0,
      task_count:  tasksByTemplate.get(t.id) ?? 0,
    }));

    return NextResponse.json({ templates });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as NewOnboardingTemplate | null;
  if (!body?.name) return NextResponse.json({ error: "name é obrigatório" }, { status: 400 });

  try {
    const { data, error } = await supabase
      .from("onboarding_templates")
      .insert({
        created_by:  user.id,
        name:        body.name,
        description: body.description ?? null,
        is_active:   body.is_active ?? true,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ template: data as OnboardingTemplate }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
