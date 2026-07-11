// PATCH  /api/workspace/onboarding/projects/[id]/documents/[docId] — status/notes/label/arquivo
// DELETE /api/workspace/onboarding/projects/[id]/documents/[docId] — remove item (admin)

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { OnboardingProjectDocument, UpdateOnboardingProjectDocument } from "@/types/onboarding";

type Params = { params: Promise<{ id: string; docId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { docId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as UpdateOnboardingProjectDocument | null;
  if (!body) return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const key of ["label", "status", "notes", "file_url", "storage_path"] as const) {
    if (key in body) patch[key] = body[key];
  }

  try {
    const { data: profile } = await supabase.from("user_profiles").select("id").eq("auth_user_id", user.id).maybeSingle();
    if (profile) patch.updated_by = profile.id;

    const { data, error } = await supabase
      .from("onboarding_project_documents")
      .update(patch)
      .eq("id", docId)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ document: data as OnboardingProjectDocument });
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
    const { error } = await supabase.from("onboarding_project_documents").delete().eq("id", docId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
