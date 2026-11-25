import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { esteiraPanelContext } from "@/lib/esteira/auth";
import { AGENTE_NOME } from "@/lib/esteira/service";
import type { EsteiraAgente } from "@/types/esteira";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

// POST /api/esteira/aprendizados/:id/decisao {decisao: "aceita"|"descartada"}
// Responde a uma proposta de regra de um agente. O agente recebe pela rota de decisões.
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const ctx = await esteiraPanelContext();
  if (!ctx) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!ctx.canManage) return NextResponse.json({ error: "Acesso restrito a proprietários e administradores." }, { status: 403 });
  const body = await req.json().catch(() => null) as { decisao?: unknown } | null;
  const decisao = body?.decisao;
  if (decisao !== "aceita" && decisao !== "descartada") return NextResponse.json({ error: "Decisão inválida." }, { status: 400 });

  const db = createAdminSupabaseClient();
  const agora = new Date().toISOString();
  const { data, error } = await db.from("esteira_aprendizados")
    .update({ status: decisao, decidido_por: ctx.user.id, decidido_em: agora, decisao_entregue_em: null })
    .eq("id", id).eq("user_id", ctx.ownerId).eq("tipo", "proposta").eq("status", "pendente")
    .select("agente,texto").maybeSingle();
  if (error) return NextResponse.json({ error: "Não foi possível registrar a decisão." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Esta proposta já foi respondida ou não existe." }, { status: 409 });

  await db.from("esteira_eventos").insert({
    user_id: ctx.ownerId, item_id: null, agente: data.agente, tipo: "decisao",
    texto: `Você ${decisao === "aceita" ? "aceitou" : "descartou"} a proposta do ${AGENTE_NOME[data.agente as EsteiraAgente]}: ${data.texto}`.slice(0, 400),
  });
  return NextResponse.json({ ok: true });
}
