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
  const camposItem = "id,agente,ref,cliente,titulo,detalhe,etapa,etapa_desde,progresso,passo_atual,links,decisao,decisao_nota,decidido_em,decisao_entregue_em,created_at,updated_at";
  const camposAprendizado = "id,agente,ref,tipo,escopo,texto,status,decidido_em,created_at";
  // Consultas simples (sem .or()), para não depender de como o PostgREST lê datas dentro de filtros compostos.
  const [ativos, entregues, eventos, pendentes, recentes] = await Promise.all([
    db.from("esteira_itens").select(camposItem).eq("user_id", ctx.ownerId)
      .in("etapa", ["pedido", "produzindo", "esperando", "aprovado"])
      .order("etapa_desde", { ascending: false }).limit(200),
    db.from("esteira_itens").select(camposItem).eq("user_id", ctx.ownerId)
      .in("etapa", ["no_ar", "concluido"]).gte("updated_at", desde7)
      .order("etapa_desde", { ascending: false }).limit(100),
    db.from("esteira_eventos").select("id,item_id,agente,tipo,texto,created_at").eq("user_id", ctx.ownerId)
      .order("created_at", { ascending: false }).limit(40),
    db.from("esteira_aprendizados").select(camposAprendizado).eq("user_id", ctx.ownerId)
      .eq("status", "pendente").order("created_at", { ascending: false }).limit(30),
    db.from("esteira_aprendizados").select(camposAprendizado).eq("user_id", ctx.ownerId)
      .gte("created_at", desde14).order("created_at", { ascending: false }).limit(60),
  ]);
  const falha = [ativos, entregues, eventos, pendentes, recentes].find((r) => r.error);
  if (falha?.error) {
    console.error("[esteira] falha ao carregar:", falha.error.message);
    return NextResponse.json({ error: "Não foi possível carregar a esteira." }, { status: 500 });
  }
  const itens = { data: [...(ativos.data ?? []), ...(entregues.data ?? [])] };
  const vistos = new Set<string>();
  const aprendizados = {
    data: [...(pendentes.data ?? []), ...(recentes.data ?? [])].filter((a) => (vistos.has(a.id) ? false : (vistos.add(a.id), true))),
  };
  return NextResponse.json({ itens: itens.data, eventos: eventos.data, aprendizados: aprendizados.data });
}
