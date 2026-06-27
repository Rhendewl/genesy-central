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
    return NextResponse.json({ error: "Formulário não encontrado ou não publicado" }, { status: 404 });
  }

  return NextResponse.json({ formulario: form });
}
