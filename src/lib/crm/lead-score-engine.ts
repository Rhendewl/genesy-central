import type { FormStep, QuestionWeight } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// LeadScoreEngine — ponto único de cálculo de IQ (Inteligência de Qualificação)
// e IE (Índice de Evolução). Puro: zero I/O, zero dependência de
// Supabase/React — só matemática, o que torna fácil testar e trocar depois
// (ex.: IA recalculando IQ com base em comportamento) sem tocar em quem chama.
//
// O usuário nunca define números — só "peso da pergunta" (Ignorar/Baixo/
// Médio/Alto/Crítico) e "classificação da resposta" (1-5 estrelas por
// alternativa). A escala peso→multiplicador abaixo é interna, nunca exposta.
// ─────────────────────────────────────────────────────────────────────────────

const WEIGHT_MULTIPLIER: Record<Exclude<QuestionWeight, "ignore">, number> = {
  low:      1,
  medium:   2,
  high:     3,
  critical: 5, // pula o 4 de propósito — "Crítico" deve dominar o cálculo
};

const MAX_STAR_SCORE = 5;
/** Classificação neutra usada quando uma alternativa nunca recebeu estrelas. */
const NEUTRAL_SCORE = 3;

export const LeadScoreEngine = {
  /**
   * IQ — calculado uma única vez a partir das respostas do formulário no
   * momento da submissão (ou de um recálculo manual). Só perguntas
   * `single_choice` participam (é o único tipo com "alternativas" para
   * classificar em estrelas) — mesmo recorte usado pelo Motor de Lógica
   * Condicional.
   *
   * Retorna `null` quando nenhuma pergunta do formulário tem peso
   * configurado — não há nada para calcular, e isso é "não aplicável",
   * não é 0.
   */
  calculateIQ(steps: FormStep[], answers: Record<string, unknown>): number | null {
    let obtained    = 0;
    let maxPossible = 0;

    for (const step of steps) {
      if (step.type !== "single_choice") continue;
      const weight = step.weight;
      if (!weight || weight === "ignore") continue;

      const multiplier = WEIGHT_MULTIPLIER[weight];
      maxPossible += multiplier * MAX_STAR_SCORE;

      const answerValue = answers[step.id];
      if (answerValue === undefined || answerValue === null || answerValue === "") {
        // Pergunta ponderada mas nunca respondida (pulada via lógica
        // condicional, ou abandono) — conta 0 no numerador, mas o peso
        // continua no denominador: pular uma pergunta crítica deve, sim,
        // reduzir o IQ, não encolher a régua para esconder a lacuna.
        continue;
      }

      const choice = step.choices?.find(c => c.value === answerValue);
      const score  = choice?.score ?? NEUTRAL_SCORE; // não classificada → neutro
      obtained += multiplier * score;
    }

    if (maxPossible === 0) return null;
    return Math.max(0, Math.min(100, Math.round((obtained / maxPossible) * 100)));
  },

  /**
   * IE — recalculado automaticamente a cada mudança de etapa.
   * `orderIndex` é 0-based (posição da etapa na pipeline, `crm_stages.order_index`).
   * `totalActiveStages` é a contagem de etapas ativas daquela pipeline.
   */
  calculateIE(orderIndex: number, totalActiveStages: number): number {
    if (totalActiveStages <= 0) return 0;
    const pct = ((orderIndex + 1) / totalActiveStages) * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
  },

  /**
   * IG (Índice Genesy) — média de IQ e IE, só para exibição resumida (ex.:
   * card do Kanban). Não é persistido; é derivado on-the-fly a partir dos
   * dois índices já calculados/salvos no lead.
   *
   * Quando só um dos dois está disponível, usa esse valor sozinho (a média
   * de "um número e nada" é o próprio número) — assim o card sempre mostra
   * algo útil mesmo pra leads sem IQ (ex.: origem manual/webhook, que nunca
   * têm formulário pontuável, mas normalmente têm IE assim que entram numa
   * etapa). `null` só quando nenhum dos dois está disponível.
   */
  calculateIG(iq: number | null, ie: number | null): number | null {
    if (iq === null && ie === null) return null;
    if (iq === null) return ie;
    if (ie === null) return iq;
    return Math.round((iq + ie) / 2);
  },
};
