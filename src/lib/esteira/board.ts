// Cálculos puros da tela da Esteira (agrupamento, indicadores e tempos).

import { ESTEIRA_COLUNAS, type EsteiraAgente, type EsteiraEtapa, type EsteiraItem } from "@/types/esteira";

export const AGENTES_INFO: Record<EsteiraAgente, { nome: string; papel: string; cor: string; inicial: string; foto: string; gradiente: [string, string] }> = {
  alfred: { nome: "Alfred", papel: "Tráfego & Criativos", cor: "#27a3ff", inicial: "A", foto: "/agentes/alfred.webp", gradiente: ["#1d6bff", "#38bdf8"] },
  bruce: { nome: "Bruce Wayne", papel: "Copywriter Genesy · @lancastermatos", cor: "#27f2e6", inicial: "B", foto: "/agentes/bruce.webp", gradiente: ["#0d9488", "#2dd4bf"] },
};

export type Coluna = { etapa: EsteiraEtapa; label: string; itens: EsteiraItem[] };

/** Colunas da linha de um agente. Itens concluídos aparecem junto com "No ar". */
export function colunasDoAgente(itens: EsteiraItem[], agente: EsteiraAgente): Coluna[] {
  const doAgente = itens.filter((i) => i.agente === agente && i.etapa !== "cancelado");
  return ESTEIRA_COLUNAS.map(({ etapa, label }) => ({
    etapa,
    label,
    itens: doAgente
      .filter((i) => (etapa === "no_ar" ? i.etapa === "no_ar" || i.etapa === "concluido" : i.etapa === etapa))
      // Mais antigo primeiro em "Esperando você" (o que está parado há mais tempo); nas outras, o mais recente.
      .sort((a, b) => etapa === "esperando"
        ? Date.parse(a.etapa_desde) - Date.parse(b.etapa_desde)
        : Date.parse(b.etapa_desde) - Date.parse(a.etapa_desde)),
  }));
}

export function indicadores(itens: EsteiraItem[], agora: number) {
  const inicioHoje = new Date(agora); inicioHoje.setHours(0, 0, 0, 0);
  const entreguesHoje = itens.filter((i) => (i.etapa === "no_ar" || i.etapa === "concluido") && Date.parse(i.etapa_desde) >= inicioHoje.getTime());
  const duracoes = itens
    .filter((i) => i.etapa === "no_ar" || i.etapa === "concluido")
    .map((i) => Date.parse(i.etapa_desde) - Date.parse(i.created_at))
    .filter((ms) => Number.isFinite(ms) && ms >= 0);
  const media = duracoes.length ? duracoes.reduce((s, ms) => s + ms, 0) / duracoes.length : null;
  return {
    esperando: itens.filter((i) => i.etapa === "esperando").length,
    produzindo: itens.filter((i) => i.etapa === "produzindo").length,
    entreguesHoje: entreguesHoje.length,
    tempoMedio: media === null ? null : duracao(media),
  };
}

export function duracao(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} d ${h % 24} h` : `${d} d`;
}

/** "agora", "há 4 min", "há 2 h", "ontem 20:07", "18/11 09:01". */
export function tempoRelativo(iso: string, agora: number): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const diff = agora - t;
  if (diff < 60_000) return "agora";
  if (diff < 3_600_000) return `há ${Math.floor(diff / 60_000)} min`;
  const data = new Date(t);
  const hora = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const hoje = new Date(agora); hoje.setHours(0, 0, 0, 0);
  if (t >= hoje.getTime()) return diff < 6 * 3_600_000 ? `há ${Math.floor(diff / 3_600_000)} h` : `hoje ${hora}`;
  if (t >= hoje.getTime() - 86_400_000) return `ontem ${hora}`;
  return `${data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${hora}`;
}
