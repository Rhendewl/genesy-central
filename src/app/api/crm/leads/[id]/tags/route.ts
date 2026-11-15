import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getPlatformEventBus } from "@/lib/event-bus/platform";

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/crm/leads/[id]/tags
//
// Único caminho de escrita de tags que passa pelo servidor — necessário para
// que o Workflow Engine consiga reagir a "lead recebeu tag"/"lead removeu
// tag". useLeads.ts (client) chama esta rota em vez de escrever `tags`
// direto no Supabase; os demais campos do lead continuam com update direto.
// ─────────────────────────────────────────────────────────────────────────────

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: leadId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json() as { tags?: string[] };
  if (!Array.isArray(body.tags) || body.tags.some(tag => typeof tag !== "string")) {
    return NextResponse.json({ error: "tags deve ser um array" }, { status: 400 });
  }
  const nextTags = body.tags;

  const { data: current, error: fetchErr } = await supabase
    .from("leads")
    .select("tags,pipeline_id")
    .eq("id", leadId)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!current)  return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });

  if (process.env.NEXT_PUBLIC_CRM_PIPELINE_TAGS_ENABLED === "true" && nextTags.length) {
    if (!current.pipeline_id) return NextResponse.json({ error: "O lead precisa estar em uma pipeline." }, { status: 400 });
    const catalog = await supabase.from("crm_pipeline_tags").select("id").eq("pipeline_id", current.pipeline_id).in("id", nextTags);
    if (catalog.error) return NextResponse.json({ error: catalog.error.message }, { status: 500 });
    const allowed = new Set((catalog.data ?? []).map(tag => tag.id));
    if (nextTags.some(id => !allowed.has(id))) return NextResponse.json({ error: "Selecione apenas etiquetas desta pipeline." }, { status: 400 });
  }

  const currentTags: string[] = (current.tags as string[] | null) ?? [];

  const { error: updateErr } = await supabase
    .from("leads")
    .update({ tags: nextTags })
    .eq("id", leadId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  const added   = nextTags.filter(t => !currentTags.includes(t));
  const removed = currentTags.filter(t => !nextTags.includes(t));

  const bus = getPlatformEventBus();
  for (const tagId of added)   bus.publish("lead.tag.added",   { leadId, tagId, userId: user.id });
  for (const tagId of removed) bus.publish("lead.tag.removed", { leadId, tagId, userId: user.id });

  return NextResponse.json({ ok: true, tags: nextTags });
}
