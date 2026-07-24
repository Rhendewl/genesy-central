import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

type Params = { params: Promise<{ slug: string }> };

// GET /api/form/:slug — carrega um formulário publicado para o renderer público.
// Usa admin client: sem sessão de usuário, apenas valida status e deleted_at.
export async function GET(_req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const supabase = createAdminSupabaseClient();

  const { data: form, error } = await supabase
    .from("forms")
    .select("id, user_id, name, slug, description, status, theme, settings, steps, logic_rules, welcome_screen, endings")
    .eq("slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .single();

  if (error || !form) {
    return NextResponse.json(
      { error: "Formulário não encontrado ou não publicado" },
      { status: 404, headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" } },
    );
  }

  return NextResponse.json(
    { formulario: form },
    {
      headers: {
        // O conteúdo publicado é igual para todos os visitantes. A borda pode
        // servi-lo sem nova consulta, mantendo uma janela curta para edições.
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
