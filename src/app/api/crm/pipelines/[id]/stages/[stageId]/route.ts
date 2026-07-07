import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type Params = { params: Promise<{ id: string; stageId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { stageId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("crm_stages")
    .select("*")
    .eq("id", stageId)
    .single();

  if (error || !data) return NextResponse.json({ error: "Etapa não encontrada" }, { status: 404 });
  return NextResponse.json({ stage: data });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { stageId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  const allowed = [
    "name", "description", "color", "icon", "order_index",
    "is_active", "allow_free_move", "require_note", "require_attachment", "allow_edit",
    "is_won", "is_lost",
  ] as const;
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }
  if (typeof update.name === "string") update.name = (update.name as string).trim();

  const { data, error } = await supabase
    .from("crm_stages")
    .update(update)
    .eq("id", stageId)
    .select()
    .single();

  if (error || !data) return NextResponse.json({ error: "Etapa não encontrada" }, { status: 404 });
  return NextResponse.json({ stage: data });
}

// DELETE /api/crm/pipelines/:id/stages/:stageId?force=1
//
// Exclusão permanente da etapa (antes era só um soft-delete disfarçado —
// is_active=false, o mesmo que o toggle "Desativar" já fazia). FKs de
// crm_stages já são SET NULL (leads.stage_id, crm_lead_stage_history.stage_id)
// ou CASCADE (crm_stage_conversions, crm_notification_rules) — o banco nunca
// rejeitaria o delete. Por isso o guard de leads é só um aviso: sem `force`,
// bloqueia com 409 + a contagem; com `force=1`, prossegue e os leads dessa
// etapa ficam "Sem Etapa" (stage_id = null) — visíveis na coluna própria do
// Kanban, não são apagados nem perdem dados.
export async function DELETE(req: NextRequest, { params }: Params) {
  const { stageId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const force = req.nextUrl.searchParams.get("force") === "1";

  const { count } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("stage_id", stageId);

  const leadCount = count ?? 0;

  if (leadCount > 0 && !force) {
    return NextResponse.json(
      { error: `${leadCount} lead(s) nesta etapa`, leadCount },
      { status: 409 },
    );
  }

  const { error } = await supabase
    .from("crm_stages")
    .delete()
    .eq("id", stageId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, leadCount });
}
