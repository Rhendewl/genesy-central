import type { SupabaseClient } from "@supabase/supabase-js";
import type { EsteiraAgente, EsteiraEtapa } from "@/types/esteira";
import type { AprendizadoPayload, EventoPayload, ItemPayload } from "./payload";

export const AGENTE_NOME: Record<EsteiraAgente, string> = { alfred: "Alfred", bruce: "Bruce" };

export const ETAPA_LABEL: Record<EsteiraEtapa, string> = {
  pedido: "Pedido",
  produzindo: "Produzindo",
  esperando: "Esperando você",
  aprovado: "Aprovado",
  no_ar: "No ar",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

type Db = SupabaseClient;
type ServiceResult = { ok: true; status: number; body: Record<string, unknown> } | { ok: false; status: number; error: string };

async function addEvento(db: Db, row: { user_id: string; item_id: string | null; agente: EsteiraAgente | null; tipo: string; texto: string }) {
  await db.from("esteira_eventos").insert({ ...row, texto: row.texto.slice(0, 400) });
}

/** Cria ou atualiza o item de um agente (chave: agente + ref) e registra o que mudou no feed. */
export async function registrarItem(db: Db, ownerId: string, p: ItemPayload): Promise<ServiceResult> {
  const nome = AGENTE_NOME[p.agente];
  const { data: atual, error: readError } = await db
    .from("esteira_itens")
    .select("id,titulo,etapa,passo_atual")
    .eq("user_id", ownerId).eq("agente", p.agente).eq("ref", p.ref)
    .maybeSingle();
  if (readError) return { ok: false, status: 500, error: "Não foi possível ler a esteira." };

  const agora = new Date().toISOString();

  if (!atual) {
    if (!p.titulo) return { ok: false, status: 400, error: 'Item novo precisa de "titulo".' };
    const etapa = p.etapa ?? "pedido";
    const { data: criado, error } = await db.from("esteira_itens").insert({
      user_id: ownerId, agente: p.agente, ref: p.ref, titulo: p.titulo,
      cliente: p.cliente ?? null, detalhe: p.detalhe ?? null, etapa, etapa_desde: agora,
      progresso: p.progresso ?? null, passo_atual: p.passo ?? null, links: p.links ?? [],
    }).select("id").single();
    if (error || !criado) return { ok: false, status: 500, error: "Não foi possível criar o item." };
    const quem = p.cliente ? ` · ${p.cliente}` : "";
    await addEvento(db, { user_id: ownerId, item_id: criado.id, agente: p.agente, tipo: "etapa",
      texto: `${nome}: “${p.titulo}”${quem} entrou em ${ETAPA_LABEL[etapa]}` });
    if (p.mensagem) await addEvento(db, { user_id: ownerId, item_id: criado.id, agente: p.agente, tipo: "mensagem", texto: `${nome}: ${p.mensagem}` });
    return { ok: true, status: 201, body: { id: criado.id, criado: true } };
  }

  const update: Record<string, unknown> = { updated_at: agora };
  if (p.titulo !== undefined) update.titulo = p.titulo;
  if (p.cliente !== undefined) update.cliente = p.cliente;
  if (p.detalhe !== undefined) update.detalhe = p.detalhe;
  if (p.links !== undefined) update.links = p.links;
  if (p.passo !== undefined) update.passo_atual = p.passo;
  if (p.progresso !== undefined) update.progresso = p.progresso;

  const mudouEtapa = p.etapa !== undefined && p.etapa !== atual.etapa;
  if (mudouEtapa) {
    update.etapa = p.etapa;
    update.etapa_desde = agora;
    if (p.progresso === undefined) update.progresso = null;
    if (p.passo === undefined) update.passo_atual = null;
    // Voltar a "Esperando você" abre uma nova rodada de aprovação.
    if (p.etapa === "esperando") {
      Object.assign(update, { decisao: null, decisao_nota: null, decidido_por: null, decidido_em: null, decisao_entregue_em: null });
    }
  }

  const { error } = await db.from("esteira_itens").update(update).eq("id", atual.id);
  if (error) return { ok: false, status: 500, error: "Não foi possível atualizar o item." };

  const titulo = p.titulo ?? atual.titulo;
  if (mudouEtapa) {
    await addEvento(db, { user_id: ownerId, item_id: atual.id, agente: p.agente, tipo: "etapa",
      texto: `${nome}: “${titulo}” foi para ${ETAPA_LABEL[p.etapa as EsteiraEtapa]}` });
  } else if (p.passo && p.passo !== atual.passo_atual) {
    await addEvento(db, { user_id: ownerId, item_id: atual.id, agente: p.agente, tipo: "passo", texto: `${nome}: ${p.passo}` });
  }
  if (p.mensagem) await addEvento(db, { user_id: ownerId, item_id: atual.id, agente: p.agente, tipo: "mensagem", texto: `${nome}: ${p.mensagem}` });
  return { ok: true, status: 200, body: { id: atual.id, criado: false } };
}

export async function registrarEvento(db: Db, ownerId: string, p: EventoPayload): Promise<ServiceResult> {
  let itemId: string | null = null;
  if (p.ref) {
    const { data } = await db.from("esteira_itens").select("id").eq("user_id", ownerId).eq("agente", p.agente).eq("ref", p.ref).maybeSingle();
    itemId = data?.id ?? null;
  }
  const { error } = await db.from("esteira_eventos").insert({
    user_id: ownerId, item_id: itemId, agente: p.agente, tipo: "mensagem", texto: `${AGENTE_NOME[p.agente]}: ${p.texto}`.slice(0, 400),
  });
  if (error) return { ok: false, status: 500, error: "Não foi possível registrar o evento." };
  return { ok: true, status: 201, body: { ok: true } };
}

export async function registrarAprendizado(db: Db, ownerId: string, p: AprendizadoPayload): Promise<ServiceResult> {
  const row = {
    user_id: ownerId, agente: p.agente, ref: p.ref, tipo: p.tipo, escopo: p.escopo, texto: p.texto,
    status: p.tipo === "regra" ? "salva" : "pendente",
  };
  const query = p.ref
    ? db.from("esteira_aprendizados").upsert(row, { onConflict: "user_id,agente,ref" })
    : db.from("esteira_aprendizados").insert(row);
  const { error } = await query;
  if (error) return { ok: false, status: 500, error: "Não foi possível registrar o aprendizado." };
  const nome = AGENTE_NOME[p.agente];
  const onde = p.escopo ? ` (${p.escopo})` : "";
  await addEvento(db, { user_id: ownerId, item_id: null, agente: p.agente, tipo: p.tipo === "regra" ? "aprendizado" : "proposta",
    texto: p.tipo === "regra" ? `${nome} aprendeu uma regra${onde}: ${p.texto}` : `${nome} sugeriu uma regra${onde}: ${p.texto}` });
  return { ok: true, status: 201, body: { ok: true } };
}
