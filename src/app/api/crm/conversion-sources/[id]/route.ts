import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type Params = { params: Promise<{ id: string }> };

const MASKED = "__masked__";

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;

  const allowed = ["name", "description", "pixel_id", "access_token", "test_event_code", "is_default", "is_active"] as const;
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (!(key in body)) continue;
    if (key === "access_token" && (body[key] === MASKED || body[key] === "")) continue;
    update[key] = body[key];
  }
  if (typeof update.name === "string")         update.name         = (update.name as string).trim();
  if (typeof update.pixel_id === "string")     update.pixel_id     = (update.pixel_id as string).trim();
  if (typeof update.access_token === "string") update.access_token = (update.access_token as string).trim();

  const { data, error } = await supabase
    .from("crm_conversion_sources")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Já existe uma origem padrão para este provider nesta pipeline" },
        { status: 409 }
      );
    }
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Origem não encontrada" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ source: { ...data, access_token: MASKED } });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { error } = await supabase
    .from("crm_conversion_sources")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
