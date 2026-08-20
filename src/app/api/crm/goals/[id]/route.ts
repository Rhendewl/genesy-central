import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type Params = { params: Promise<{ id: string }> };
const ALLOWED = [
  "pipeline_id", "name", "starts_at", "ends_at", "revenue_target", "sales_target",
  "held_meetings_target", "scheduled_meetings_target", "is_active",
] as const;

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  const update: Record<string, unknown> = {};
  for (const key of ALLOWED) if (key in body) update[key] = body[key] === "" ? null : body[key];
  if (typeof update.name === "string") update.name = update.name.trim();
  if (!Object.keys(update).length) return NextResponse.json({ error: "Nenhuma alteração enviada" }, { status: 400 });

  const { data, error } = await supabase.from("crm_goals").update(update).eq("id", id).select().single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Meta não encontrada" }, { status: error ? 400 : 404 });
  return NextResponse.json({ goal: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { error } = await supabase.from("crm_goals").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
