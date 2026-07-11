// POST /api/workspace/onboarding/templates/[id]/documents — adiciona item ao checklist de documentos do template

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { NewOnboardingTemplateDocument, OnboardingTemplateDocument } from "@/types/onboarding";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as NewOnboardingTemplateDocument | null;
  if (!body?.label) return NextResponse.json({ error: "label é obrigatório" }, { status: 400 });

  try {
    const { data: maxRow } = await supabase
      .from("onboarding_template_documents")
      .select("order_index")
      .eq("template_id", id)
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle();

    const order_index = body.order_index ?? (maxRow?.order_index ?? -1) + 1;

    const { data, error } = await supabase
      .from("onboarding_template_documents")
      .insert({ template_id: id, label: body.label, order_index })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ document: data as OnboardingTemplateDocument }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
