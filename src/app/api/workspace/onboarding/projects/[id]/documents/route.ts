// GET  /api/workspace/onboarding/projects/[id]/documents — checklist de documentos/acessos
// POST /api/workspace/onboarding/projects/[id]/documents — adiciona item ad-hoc (admin)

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { NewOnboardingProjectDocument, OnboardingProjectDocument } from "@/types/onboarding";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const { data, error } = await supabase
      .from("onboarding_project_documents")
      .select("*")
      .eq("project_id", id)
      .order("created_at");
    if (error) throw new Error(error.message);
    return NextResponse.json({ documents: (data ?? []) as OnboardingProjectDocument[] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as NewOnboardingProjectDocument | null;
  if (!body?.label) return NextResponse.json({ error: "label é obrigatório" }, { status: 400 });

  try {
    const { data, error } = await supabase
      .from("onboarding_project_documents")
      .insert({ project_id: id, label: body.label })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ document: data as OnboardingProjectDocument }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
