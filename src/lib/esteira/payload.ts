// Validação dos dados que os agentes (Alfred e Bruce) mandam para a esteira.
// Funções puras: recebem o JSON cru e devolvem um objeto limpo ou um erro em
// português que o agente consegue entender e corrigir.

import { ESTEIRA_AGENTES, ESTEIRA_ETAPAS, type EsteiraAgente, type EsteiraEtapa, type EsteiraLink } from "@/types/esteira";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function text(v: unknown, field: string, max: number, required: boolean): Result<string | null> {
  if (v === undefined || v === null || v === "") {
    return required ? { ok: false, error: `Campo "${field}" é obrigatório.` } : { ok: true, value: null };
  }
  if (typeof v !== "string") return { ok: false, error: `Campo "${field}" precisa ser texto.` };
  const clean = v.replace(/\s+/g, " ").trim();
  if (!clean && required) return { ok: false, error: `Campo "${field}" é obrigatório.` };
  if (clean.length > max) return { ok: false, error: `Campo "${field}" passa de ${max} caracteres.` };
  return { ok: true, value: clean || null };
}

export function parseAgente(v: unknown): Result<EsteiraAgente> {
  return typeof v === "string" && (ESTEIRA_AGENTES as readonly string[]).includes(v)
    ? { ok: true, value: v as EsteiraAgente }
    : { ok: false, error: `Campo "agente" precisa ser um de: ${ESTEIRA_AGENTES.join(", ")}.` };
}

export function parseRef(v: unknown): Result<string> {
  if (typeof v !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(v)) {
    return { ok: false, error: 'Campo "ref" é obrigatório: letras, números, ponto, hífen, dois-pontos ou sublinhado (até 120).' };
  }
  return { ok: true, value: v };
}

function parseLinks(v: unknown): Result<EsteiraLink[] | undefined> {
  if (v === undefined) return { ok: true, value: undefined };
  if (!Array.isArray(v) || v.length > 10) return { ok: false, error: 'Campo "links" precisa ser uma lista de até 10 itens.' };
  const out: EsteiraLink[] = [];
  for (const raw of v) {
    if (!isObject(raw) || typeof raw.url !== "string") return { ok: false, error: 'Cada link precisa de "url".' };
    let url: URL;
    try { url = new URL(raw.url); } catch { return { ok: false, error: `Link inválido: ${raw.url.slice(0, 80)}` }; }
    if (url.protocol !== "https:") return { ok: false, error: "Links precisam começar com https://." };
    const label = text(raw.label ?? "Abrir", "links.label", 60, true);
    if (!label.ok) return label;
    out.push({ label: label.value as string, url: url.toString() });
  }
  return { ok: true, value: out };
}

export interface ItemPayload {
  agente: EsteiraAgente;
  ref: string;
  titulo?: string;
  cliente?: string | null;
  detalhe?: string | null;
  etapa?: EsteiraEtapa;
  progresso?: number | null;
  passo?: string | null;
  links?: EsteiraLink[];
  mensagem?: string | null;
}

/** Cria ou atualiza um item. "titulo" só é obrigatório na primeira vez (a rota confere). */
export function parseItemPayload(body: unknown): Result<ItemPayload> {
  if (!isObject(body)) return { ok: false, error: "Envie um objeto JSON." };
  const agente = parseAgente(body.agente); if (!agente.ok) return agente;
  const ref = parseRef(body.ref); if (!ref.ok) return ref;
  const out: ItemPayload = { agente: agente.value, ref: ref.value };

  if (body.titulo !== undefined) { const r = text(body.titulo, "titulo", 200, true); if (!r.ok) return r; out.titulo = r.value as string; }
  if (body.cliente !== undefined) { const r = text(body.cliente, "cliente", 120, false); if (!r.ok) return r; out.cliente = r.value; }
  if (body.detalhe !== undefined) { const r = text(body.detalhe, "detalhe", 600, false); if (!r.ok) return r; out.detalhe = r.value; }
  if (body.passo !== undefined) { const r = text(body.passo, "passo", 200, false); if (!r.ok) return r; out.passo = r.value; }
  if (body.mensagem !== undefined) { const r = text(body.mensagem, "mensagem", 400, false); if (!r.ok) return r; out.mensagem = r.value; }
  if (body.etapa !== undefined) {
    if (typeof body.etapa !== "string" || !(ESTEIRA_ETAPAS as readonly string[]).includes(body.etapa)) {
      return { ok: false, error: `Campo "etapa" precisa ser um de: ${ESTEIRA_ETAPAS.join(", ")}.` };
    }
    out.etapa = body.etapa as EsteiraEtapa;
  }
  if (body.progresso !== undefined) {
    if (body.progresso === null) out.progresso = null;
    else if (typeof body.progresso !== "number" || !Number.isFinite(body.progresso) || body.progresso < 0 || body.progresso > 100) {
      return { ok: false, error: 'Campo "progresso" precisa ser um número de 0 a 100.' };
    } else out.progresso = Math.round(body.progresso);
  }
  const links = parseLinks(body.links); if (!links.ok) return links;
  if (links.value) out.links = links.value;
  return { ok: true, value: out };
}

export interface EventoPayload { agente: EsteiraAgente; ref: string | null; texto: string }

export function parseEventoPayload(body: unknown): Result<EventoPayload> {
  if (!isObject(body)) return { ok: false, error: "Envie um objeto JSON." };
  const agente = parseAgente(body.agente); if (!agente.ok) return agente;
  let ref: string | null = null;
  if (body.ref !== undefined && body.ref !== null) { const r = parseRef(body.ref); if (!r.ok) return r; ref = r.value; }
  const texto = text(body.texto, "texto", 400, true); if (!texto.ok) return texto;
  return { ok: true, value: { agente: agente.value, ref, texto: texto.value as string } };
}

export interface AprendizadoPayload {
  agente: EsteiraAgente;
  ref: string | null;
  tipo: "regra" | "proposta";
  escopo: string | null;
  texto: string;
}

export function parseAprendizadoPayload(body: unknown): Result<AprendizadoPayload> {
  if (!isObject(body)) return { ok: false, error: "Envie um objeto JSON." };
  const agente = parseAgente(body.agente); if (!agente.ok) return agente;
  if (body.tipo !== "regra" && body.tipo !== "proposta") return { ok: false, error: 'Campo "tipo" precisa ser "regra" ou "proposta".' };
  let ref: string | null = null;
  if (body.ref !== undefined && body.ref !== null) { const r = parseRef(body.ref); if (!r.ok) return r; ref = r.value; }
  if (body.tipo === "proposta" && !ref) return { ok: false, error: 'Proposta precisa de "ref", para a decisão voltar ao agente.' };
  const escopo = text(body.escopo, "escopo", 120, false); if (!escopo.ok) return escopo;
  const texto = text(body.texto, "texto", 600, true); if (!texto.ok) return texto;
  return { ok: true, value: { agente: agente.value, ref, tipo: body.tipo, escopo: escopo.value, texto: texto.value as string } };
}

export interface DecisaoPayload { decisao: "aprovado" | "ajuste"; nota: string | null }

export function parseDecisaoPayload(body: unknown): Result<DecisaoPayload> {
  if (!isObject(body)) return { ok: false, error: "Envie um objeto JSON." };
  if (body.decisao !== "aprovado" && body.decisao !== "ajuste") return { ok: false, error: "Decisão inválida." };
  const nota = text(body.nota, "nota", 1000, body.decisao === "ajuste");
  if (!nota.ok) return body.decisao === "ajuste" ? { ok: false, error: "Escreva o que precisa ser ajustado." } : nota;
  return { ok: true, value: { decisao: body.decisao, nota: nota.value } };
}
