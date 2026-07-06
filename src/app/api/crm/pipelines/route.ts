import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const all = new URL(req.url).searchParams.get("all") === "1";

  let query = supabase
    .from("crm_pipelines")
    .select("*, crm_stages(*)")
    .order("order_index", { ascending: true })
    .order("order_index", { foreignTable: "crm_stages", ascending: true });

  if (!all) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pipelines: data });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  const name = body.name as string | undefined;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("crm_pipelines")
    .insert({
      name:        name.trim(),
      description: (body.description as string | null) ?? null,
      color:       (body.color as string) ?? "#4a8fd4",
      icon:        (body.icon  as string) ?? "kanban",
      order_index: (body.order_index as number) ?? 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pipeline: data }, { status: 201 });
}
