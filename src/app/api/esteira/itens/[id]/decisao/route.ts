import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { esteiraPanelContext } from "@/lib/esteira/auth";
import { parseDecisaoPayload } from "@/lib/esteira/payload";
import { AGENTE_NOME } from "@/lib/esteira/service";
import type { EsteiraAgente } from "@/types/esteira";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

// POST /api/esteira/itens/:id/decisao {decisao: "aprovado"|"ajuste", nota?}
// Aprova ou pede ajuste pela plataforma. O agente recebe a decisão pela rota
// /api/esteira/agente/decisoes e continua o trabalho (publicar, ajustar...).
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const ctx = await esteiraPanelContext();
  if (!ctx) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!ctx.canManage) return NextResponse.json({ error: "Acesso restrito a proprietários e administradores." }, { status: 403 });
  const parsed = parseDecisaoPayload(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const db = createAdminSupabaseClient();
  const { data: item } = await db.from("esteira_itens").select("id,agente,titulo,etapa")
    .eq("id", id).eq("user_id", ctx.ownerId).maybeSingle();
  if (!item) return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
  if (item.etapa !== "esperando") return NextResponse.json({ error: "Este item não está esperando aprovação." }, { status: 409 });

  const agora = new Date().toISOString();
  const aprovado = parsed.value.decisao === "aprovado";
  const { data: atualizado, error } = await db.from("esteira_itens").update({
    decisao: parsed.value.decisao,
    decisao_nota: parsed.value.nota,
    decidido_por: ctx.user.id,
    decidido_em: agora,
    decisao_entregue_em: null,
    etapa: aprovado ? "aprovado" : "produzindo",
    etapa_desde: agora,
    progresso: null,
    passo_atual: aprovado ? "Aprovado pela plataforma; o agente vai continuar" : "Ajuste pedido pela plataforma",
    updated_at: agora,
  }).eq("id", item.id).eq("etapa", "esperando").select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "Não foi possível registrar a decisão." }, { status: 500 });
  if (!atualizado) return NextResponse.json({ error: "Este item acabou de mudar. Atualize a tela." }, { status: 409 });

  const nome = AGENTE_NOME[item.agente as EsteiraAgente];
  await db.from("esteira_eventos").insert({
    user_id: ctx.ownerId, item_id: item.id, agente: item.agente, tipo: "decisao",
    texto: (aprovado ? `Você aprovou “${item.titulo}” (${nome})` : `Você pediu ajuste em “${item.titulo}” (${nome}): ${parsed.value.nota}`).slice(0, 400),
  });
  return NextResponse.json({ ok: true });
}
