// Esteira das IAs — tipos compartilhados entre API, hook e tela.

export const ESTEIRA_AGENTES = ["alfred", "bruce"] as const;
export type EsteiraAgente = (typeof ESTEIRA_AGENTES)[number];

export const ESTEIRA_ETAPAS = ["pedido", "produzindo", "esperando", "aprovado", "no_ar", "concluido", "cancelado"] as const;
export type EsteiraEtapa = (typeof ESTEIRA_ETAPAS)[number];

/** Etapas que aparecem como colunas na tela, nesta ordem. */
export const ESTEIRA_COLUNAS: { etapa: EsteiraEtapa; label: string }[] = [
  { etapa: "pedido", label: "Pedido" },
  { etapa: "produzindo", label: "Produzindo" },
  { etapa: "esperando", label: "Esperando você" },
  { etapa: "aprovado", label: "Aprovado" },
  { etapa: "no_ar", label: "No ar" },
];

export interface EsteiraLink {
  label: string;
  url: string;
}

export interface EsteiraItem {
  id: string;
  agente: EsteiraAgente;
  ref: string;
  cliente: string | null;
  titulo: string;
  detalhe: string | null;
  etapa: EsteiraEtapa;
  etapa_desde: string;
  progresso: number | null;
  passo_atual: string | null;
  links: EsteiraLink[];
  decisao: "aprovado" | "ajuste" | null;
  decisao_nota: string | null;
  decidido_em: string | null;
  decisao_entregue_em: string | null;
  created_at: string;
  updated_at: string;
}

export type EsteiraEventoTipo = "etapa" | "passo" | "mensagem" | "decisao" | "aprendizado" | "proposta";

export interface EsteiraEvento {
  id: string;
  item_id: string | null;
  agente: EsteiraAgente | null;
  tipo: EsteiraEventoTipo;
  texto: string;
  created_at: string;
}

export interface EsteiraAprendizado {
  id: string;
  agente: EsteiraAgente;
  ref: string | null;
  tipo: "regra" | "proposta";
  escopo: string | null;
  texto: string;
  status: "salva" | "pendente" | "aceita" | "descartada";
  decidido_em: string | null;
  created_at: string;
}

export interface EsteiraSnapshot {
  itens: EsteiraItem[];
  eventos: EsteiraEvento[];
  aprendizados: EsteiraAprendizado[];
}
