// POST /api/workspace/onboarding/tasks/[taskId]/checklist — cria item de checklist

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { OnboardingTaskChecklistItem } from "@/types/onboarding";

type Params = { params: Promise<{ taskId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { taskId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as { label?: string } | null;
  if (!body?.label) return NextResponse.json({ error: "label é obrigatório" }, { status: 400 });

  try {
    const { data: maxRow } = await supabase
      .from("onboarding_task_checklist_items")
      .select("position")
      .eq("task_id", taskId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const position = (maxRow?.position ?? -10) + 10;

    const { data, error } = await supabase
      .from("onboarding_task_checklist_items")
      .insert({ task_id: taskId, label: body.label, position })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ item: data as OnboardingTaskChecklistItem }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
