import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TARGETS = ["revenue_target", "sales_target", "held_meetings_target", "scheduled_meetings_target"] as const;

function parsePayload(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const startsAt = typeof body.starts_at === "string" ? body.starts_at : "";
  const endsAt = typeof body.ends_at === "string" ? body.ends_at : "";
  if (!name) throw new Error("Nome da meta é obrigatório");
  if (!DATE_RE.test(startsAt) || !DATE_RE.test(endsAt) || endsAt < startsAt) throw new Error("Período da meta é inválido");

  const result: Record<string, unknown> = {
    name,
    starts_at: startsAt,
    ends_at: endsAt,
    pipeline_id: typeof body.pipeline_id === "string" && body.pipeline_id ? body.pipeline_id : null,
    is_active: body.is_active !== false,
  };
  let hasTarget = false;
  for (const key of TARGETS) {
    const raw = body[key];
    const value = raw === null || raw === "" || raw === undefined ? null : Number(raw);
    if (value !== null && (!Number.isFinite(value) || value < 0)) throw new Error("Os valores da meta devem ser positivos");
    result[key] = value;
    if (value !== null && value > 0) hasTarget = true;
  }
  if (!hasTarget) throw new Error("Informe pelo menos um objetivo para a meta");
  return result;
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data, error } = await supabase.from("crm_goals").select("*").order("starts_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ goals: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const payload = parsePayload(await req.json() as Record<string, unknown>);
    const { data, error } = await supabase.from("crm_goals").insert(payload).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ goal: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Dados inválidos" }, { status: 400 });
  }
}
