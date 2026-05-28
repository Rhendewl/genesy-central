import type { CriativoProjeto, CriativoTom, CriativoEstiloVisual } from "@/types";

// Mapas de instrução por tom e estilo para enriquecer os prompts
const TOM_INSTRUCOES: Record<CriativoTom, string> = {
  urgente:      "Use linguagem de escassez e urgência. Transmita que a oportunidade é limitada e o momento de agir é agora. Verbos no imperativo.",
  sofisticado:  "Linguagem refinada, elegante. Evite clichês. Transmita exclusividade e status. Frases curtas e impactantes.",
  amigavel:     "Tom próximo, humano e acessível. Como se fosse uma conversa entre amigos. Use 'você' de forma natural.",
  profissional: "Linguagem formal e confiável. Transmita credibilidade e competência. Seja direto e claro.",
  emocional:    "Conecte com aspirações e sentimentos. Foque no sonho, na conquista, na transformação de vida.",
  direto:       "Sem rodeios. Vai direto ao ponto. Foco total no benefício e na oferta. Copy curto e objetivo.",
};

const ESTILO_VISUAL_INSTRUCOES: Record<CriativoEstiloVisual, string> = {
  minimalista: "Composição clean com muito espaço em branco. Tipografia como elemento principal. Paleta de no máximo 2 cores neutras.",
  bold:        "Cores vibrantes e contrastantes. Tipografia grande e expressiva. Alto impacto visual. Composição dinâmica.",
  luxury:      "Tons escuros com dourado ou prata. Texturas sofisticadas. Elementos premium. Muito espaço e refinamento.",
  moderno:     "Gradientes suaves e contemporâneos. Formas geométricas. Tipografia moderna e clean.",
  colorido:    "Paleta rica e alegre. Elementos gráficos vibrantes. Composição cheia de energia.",
  escuro:      "Dark mode predominante. Contraste com branco ou neon sutil. Sofisticado e tecnológico.",
};

const SEGMENTO_CONTEXTO: Record<string, string> = {
  imobiliario: "Mercado imobiliário. Os criativos devem transmitir confiança, valorização patrimonial e qualidade de vida.",
  varejo:      "Varejo e produtos. Foque em oferta, preço e benefício imediato.",
  servicos:    "Prestação de serviços. Destaque competência, resultado e confiabilidade.",
  saude:       "Saúde e bem-estar. Transmita cuidado, qualidade e resultados.",
  educacao:    "Educação e capacitação. Foque em transformação, oportunidade e futuro.",
  outro:       "Negócio em geral. Adapte para o contexto específico da oferta.",
};

export interface PromptContext {
  projeto: CriativoProjeto;
  variacao: number;
  totalVariacoes: number;
}

export function buildCopyPrompt(ctx: PromptContext): string {
  const { projeto, variacao, totalVariacoes } = ctx;
  const tomInstrucao = TOM_INSTRUCOES[projeto.tom];
  const segmentoCtx = SEGMENTO_CONTEXTO[projeto.segmento] ?? SEGMENTO_CONTEXTO.outro;

  // Cada variação tem uma diretriz ligeiramente diferente para forçar diversidade
  const variacaoDiretriz = getVariacaoDiretriz(variacao, totalVariacoes);

  return `Você é um copywriter especialista em marketing digital e publicidade de alta performance.

CONTEXTO DO NEGÓCIO:
- Segmento: ${segmentoCtx}
- Objetivo: ${projeto.objetivo}
- Público-alvo: ${projeto.publico}
- Oferta: ${projeto.oferta}

DIRETRIZES DE TOM:
${tomInstrucao}

VARIAÇÃO ${variacao} DE ${totalVariacoes}:
${variacaoDiretriz}

TAREFA:
Crie o copy para um criativo publicitário digital (feed/stories). Retorne EXATAMENTE no seguinte formato JSON, sem markdown, sem explicações:

{
  "headline": "Título principal impactante (máx 8 palavras)",
  "copy": "Texto de apoio persuasivo (máx 25 palavras)",
  "cta": "Chamada para ação (máx 4 palavras, ex: Saiba Mais, Fale Conosco, Ver Opções)"
}

Regras:
- headline: curto, impactante, memorável
- copy: complementa o headline, reforça o benefício
- cta: acionável e direto
- Tudo em português brasileiro
- NÃO use aspas duplas dentro dos valores`;
}

export function buildImagePrompt(
  projeto: CriativoProjeto,
  headline: string,
  variacao: number
): string {
  const estiloInstrucao = ESTILO_VISUAL_INSTRUCOES[projeto.estilo_visual];
  const formatoAspect = variacao % 2 === 0 ? "square format 1:1" : "square format 1:1";

  return `Professional advertising creative for ${projeto.segmento === "imobiliario" ? "real estate" : "business"} marketing campaign.

Style: ${estiloInstrucao}
Campaign theme: ${projeto.objetivo}
Visual mood: ${projeto.tom} tone, ${projeto.estilo_visual} aesthetic

Design elements:
- Clean professional advertising layout
- ${projeto.estilo_visual === "luxury" ? "Dark sophisticated background with gold accents" : ""}
- ${projeto.estilo_visual === "bold" ? "Strong vibrant colors, high contrast" : ""}
- ${projeto.estilo_visual === "minimalista" ? "Minimal white space, clean typography areas" : ""}
- ${projeto.estilo_visual === "moderno" ? "Modern gradient, geometric shapes" : ""}
- Space for text overlay
- No text in the image
- Photorealistic or high-quality graphic design style
- ${formatoAspect}
- Professional advertising quality, suitable for social media ads`;
}

function getVariacaoDiretriz(variacao: number, total: number): string {
  const diretrizes = [
    "Foque na DOR do público. Comece identificando o problema que a oferta resolve.",
    "Foque no BENEFÍCIO principal. O que o público conquista/ganha com esta oferta?",
    "Foque na PROVA SOCIAL e credibilidade. Transmita que outros já escolheram/confiam.",
    "Foque na URGÊNCIA e escassez. Por que agir agora?",
    "Foque no SONHO e aspiração. Como a vida melhora com esta oferta?",
  ];

  return diretrizes[(variacao - 1) % diretrizes.length];
}
