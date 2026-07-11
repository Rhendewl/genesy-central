// POST /api/workspace/onboarding/projects/[id]/stages — cria etapa ad-hoc no projeto (admin)

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { OnboardingProjectStage } from "@/types/onboarding";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as { name?: string; order_index?: number; due_date?: string | null; color?: string } | null;
  if (!body?.name) return NextResponse.json({ error: "name é obrigatório" }, { status: 400 });

  try {
    const { data: maxRow } = await supabase
      .from("onboarding_project_stages")
      .select("order_index")
      .eq("project_id", id)
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle();

    const order_index = body.order_index ?? (maxRow?.order_index ?? -1) + 1;

    const { data, error } = await supabase
      .from("onboarding_project_stages")
      .insert({
        project_id:  id,
        name:        body.name,
        order_index,
        due_date:    body.due_date ?? null,
        color:       body.color ?? "#4a8fd4",
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ stage: data as OnboardingProjectStage }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
