export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// GET /api/criativos/projetos
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const { data, error } = await supabase
      .from("criativo_projetos")
      .select("*, agency_clients(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[criativos/projetos GET]", error);
      return NextResponse.json({ error: "Erro ao buscar projetos." }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[criativos/projetos GET]", err);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}

// POST /api/criativos/projetos
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const body = await req.json();
    const { nome, objetivo, publico, oferta, tom, estilo_visual, segmento, client_id } = body;

    if (!nome) {
      return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("criativo_projetos")
      .insert({
        user_id: user.id,
        nome,
        objetivo: objetivo ?? null,
        publico: publico ?? null,
        oferta: oferta ?? null,
        tom: tom ?? null,
        estilo_visual: estilo_visual ?? null,
        segmento: segmento ?? null,
        client_id: client_id ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error("[criativos/projetos POST]", error);
      return NextResponse.json({ error: "Erro ao criar projeto." }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[criativos/projetos POST]", err);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
