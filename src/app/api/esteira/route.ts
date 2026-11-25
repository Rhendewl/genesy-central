import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { esteiraPanelContext } from "@/lib/esteira/auth";

export const dynamic = "force-dynamic";

const DIA = 86_400_000;

// GET /api/esteira — o que está na esteira agora, o feed recente e os aprendizados.
export async function GET() {
  const ctx = await esteiraPanelContext();
  if (!ctx) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!ctx.canManage) return NextResponse.json({ error: "Acesso restrito a proprietários e administradores." }, { status: 403 });

  const db = createAdminSupabaseClient();
  const desde7 = new Date(Date.now() - 7 * DIA).toISOString();
  const desde14 = new Date(Date.now() - 14 * DIA).toISOString();
  const [itens, eventos, aprendizados] = await Promise.all([
    db.from("esteira_itens")
      .select("id,agente,ref,cliente,titulo,detalhe,etapa,etapa_desde,progresso,passo_atual,links,decisao,decisao_nota,decidido_em,decisao_entregue_em,created_at,updated_at")
      .eq("user_id", ctx.ownerId)
      .or(`etapa.in.(pedido,produzindo,esperando,aprovado),and(etapa.in.(no_ar,concluido),updated_at.gte.${desde7})`)
      .order("etapa_desde", { ascending: false })
      .limit(300),
    db.from("esteira_eventos")
      .select("id,item_id,agente,tipo,texto,created_at")
      .eq("user_id", ctx.ownerId)
      .order("created_at", { ascending: false })
      .limit(40),
    db.from("esteira_aprendizados")
      .select("id,agente,ref,tipo,escopo,texto,status,decidido_em,created_at")
      .eq("user_id", ctx.ownerId)
      .or(`status.eq.pendente,created_at.gte.${desde14}`)
      .order("created_at", { ascending: false })
      .limit(60),
  ]);
  if (itens.error || eventos.error || aprendizados.error) {
    return NextResponse.json({ error: "Não foi possível carregar a esteira." }, { status: 500 });
  }
  return NextResponse.json({ itens: itens.data, eventos: eventos.data, aprendizados: aprendizados.data });
}
