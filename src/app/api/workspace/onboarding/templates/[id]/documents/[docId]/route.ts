// PATCH  /api/workspace/onboarding/templates/[id]/documents/[docId] — atualiza item do checklist
// DELETE /api/workspace/onboarding/templates/[id]/documents/[docId] — remove item do checklist

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { OnboardingTemplateDocument, UpdateOnboardingTemplateDocument } from "@/types/onboarding";

type Params = { params: Promise<{ id: string; docId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { docId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as UpdateOnboardingTemplateDocument | null;
  if (!body) return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const key of ["label", "order_index"] as const) {
    if (key in body) patch[key] = body[key];
  }

  try {
    const { data, error } = await supabase
      .from("onboarding_template_documents")
      .update(patch)
      .eq("id", docId)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ document: data as OnboardingTemplateDocument });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { docId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const { error } = await supabase.from("onboarding_template_documents").delete().eq("id", docId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
