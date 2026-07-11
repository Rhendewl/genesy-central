// POST /api/workspace/onboarding/templates/[id]/stages — cria etapa no template

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { NewOnboardingTemplateStage, OnboardingTemplateStage } from "@/types/onboarding";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as NewOnboardingTemplateStage | null;
  if (!body?.name) return NextResponse.json({ error: "name é obrigatório" }, { status: 400 });

  try {
    const { data: maxRow } = await supabase
      .from("onboarding_template_stages")
      .select("order_index")
      .eq("template_id", id)
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle();

    const order_index = body.order_index ?? (maxRow?.order_index ?? -1) + 1;

    const { data, error } = await supabase
      .from("onboarding_template_stages")
      .insert({
        template_id:       id,
        name:              body.name,
        order_index,
        relative_due_days: body.relative_due_days ?? 0,
        color:             body.color ?? "#4a8fd4",
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ stage: data as OnboardingTemplateStage }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
