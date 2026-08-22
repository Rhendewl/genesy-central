import type { InstagramAutomationMatch } from "./types";

export function normalizeInstagramText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesInstagramKeywords(
  text: string,
  keywords: string[],
  matchType: InstagramAutomationMatch,
) {
  if (matchType === "any") return true;
  const normalizedText = normalizeInstagramText(text);
  const normalizedKeywords = keywords.map(normalizeInstagramText).filter(Boolean);
  if (!normalizedKeywords.length || !normalizedText) return false;
  if (matchType === "exact") return normalizedKeywords.some(keyword => normalizedText === keyword);
  if (matchType === "starts_with") return normalizedKeywords.some(keyword => normalizedText.startsWith(keyword));
  return normalizedKeywords.some(keyword => normalizedText.includes(keyword));
}

export function validateInstagramSequence(input: {
  triggerType: string;
  steps: Array<{ text?: unknown; delayMinutes?: unknown }>;
}) {
  if (!Array.isArray(input.steps) || input.steps.length === 0) {
    return "Adicione ao menos uma mensagem à sequência";
  }
  if (input.steps.length > 10) return "A sequência pode ter no máximo 10 mensagens";
  if (input.triggerType === "comment" && input.steps.length > 1) {
    return "Comentários permitem uma única resposta privada; a sequência continua somente após uma resposta no Direct";
  }
  let cumulativeDelay = 0;
  for (const step of input.steps) {
    const text = typeof step.text === "string" ? step.text.trim() : "";
    const delay = Number(step.delayMinutes ?? 0);
    if (!text || text.length > 1000) return "Cada mensagem deve ter entre 1 e 1.000 caracteres";
    if (!Number.isFinite(delay) || delay < 0 || delay > 1380) return "O intervalo deve ficar entre 0 e 1.380 minutos";
    cumulativeDelay += delay;
  }
  if (input.triggerType !== "comment" && cumulativeDelay > 1380) {
    return "A sequência precisa terminar dentro da janela de 24 horas do Instagram";
  }
  return null;
}
