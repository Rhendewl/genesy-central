import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { parseCommercialAnalysisInput } from "@/lib/clientes/commercial-analysis-payload";
import { buildCommercialAnalysis } from "@/lib/clientes/commercial-analysis-engine";
import type { CommercialAnalysisInput } from "@/types/commercial-analysis";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  try {
    const input = parseCommercialAnalysisInput(await req.json() as Record<string, unknown>);
    const { data: previous } = await supabase.from("client_commercial_analyses").select("*").eq("client_id", input.client_id).neq("id", id).lt("meeting_date", input.meeting_date).order("meeting_date", { ascending: false }).limit(1).maybeSingle();
    const snapshot = buildCommercialAnalysis(input, previous as CommercialAnalysisInput | null);
    const { data, error } = await supabase.from("client_commercial_analyses").update({ ...input, analysis_snapshot: snapshot }).eq("id", id).select().single();
    if (error || !data) return NextResponse.json({ error: error?.message ?? "Análise não encontrada" }, { status: error ? 400 : 404 });
    return NextResponse.json({ analysis: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Dados inválidos" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { error } = await supabase.from("client_commercial_analyses").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
