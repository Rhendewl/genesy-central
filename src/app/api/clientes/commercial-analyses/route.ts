import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { parseCommercialAnalysisInput } from "@/lib/clientes/commercial-analysis-payload";
import { buildCommercialAnalysis } from "@/lib/clientes/commercial-analysis-engine";
import type { CommercialAnalysisInput } from "@/types/commercial-analysis";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const clientId = req.nextUrl.searchParams.get("client_id");
  let query = supabase.from("client_commercial_analyses").select("*").order("meeting_date", { ascending: false });
  if (clientId) query = query.eq("client_id", clientId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ analyses: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  try {
    const input = parseCommercialAnalysisInput(await req.json() as Record<string, unknown>);
    const { data: client } = await supabase.from("agency_clients").select("id").eq("id", input.client_id).maybeSingle();
    if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    const { data: previous } = await supabase.from("client_commercial_analyses").select("*").eq("client_id", input.client_id).order("meeting_date", { ascending: false }).limit(1).maybeSingle();
    const snapshot = buildCommercialAnalysis(input, previous as CommercialAnalysisInput | null);
    const { data, error } = await supabase.from("client_commercial_analyses").insert({ ...input, created_by: user.id, analysis_snapshot: snapshot }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ analysis: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Dados inválidos" }, { status: 400 });
  }
}
