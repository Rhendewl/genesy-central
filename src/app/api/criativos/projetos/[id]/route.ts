export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// GET /api/criativos/projetos/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const { data, error } = await supabase
      .from("criativo_projetos")
      .select("id, nome, objetivo, publico, oferta, workflow_json")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[criativos/projetos GET]", err);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}

// PATCH /api/criativos/projetos/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const body = await req.json();

    const { data, error } = await supabase
      .from("criativo_projetos")
      .update(body)
      .eq("id", params.id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("[criativos/projetos PATCH]", error);
      return NextResponse.json({ error: "Erro ao atualizar projeto." }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[criativos/projetos PATCH]", err);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}

// DELETE /api/criativos/projetos/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const { error } = await supabase
      .from("criativo_projetos")
      .delete()
      .eq("id", params.id)
      .eq("user_id", user.id);

    if (error) {
      console.error("[criativos/projetos DELETE]", error);
      return NextResponse.json({ error: "Erro ao excluir projeto." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[criativos/projetos DELETE]", err);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
