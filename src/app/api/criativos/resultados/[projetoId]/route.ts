export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// GET /api/criativos/resultados/[projetoId]
export async function GET(_req: NextRequest, { params }: { params: { projetoId: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const { data, error } = await supabase
      .from("criativo_resultados")
      .select("*")
      .eq("projeto_id", params.projetoId)
      .eq("user_id", user.id)
      .order("variacao", { ascending: true });

    if (error) {
      console.error("[criativos/resultados GET]", error);
      return NextResponse.json({ error: "Erro ao buscar resultados." }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[criativos/resultados GET]", err);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}

// PATCH /api/criativos/resultados/[projetoId]?id=xxx
// Atualiza favorito ou avaliação de um criativo específico.
export async function PATCH(req: NextRequest, { params: _ }: { params: { projetoId: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID do criativo ausente." }, { status: 400 });

    const body = await req.json();

    const { data, error } = await supabase
      .from("criativo_resultados")
      .update(body)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("[criativos/resultados PATCH]", error);
      return NextResponse.json({ error: "Erro ao atualizar criativo." }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[criativos/resultados PATCH]", err);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
