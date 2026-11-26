import type { InstagramAutomationMatch, NormalizedInstagramEvent } from "./types";
import { INSTAGRAM_MAX_SEQUENCE_MESSAGES } from "./policy";

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
  steps: Array<{ text?: unknown; delayMinutes?: unknown; button?: { label?: unknown; url?: unknown } | null }>;
}) {
  if (!Array.isArray(input.steps) || input.steps.length === 0) {
    return "Adicione ao menos uma mensagem à sequência";
  }
  if (input.steps.length > INSTAGRAM_MAX_SEQUENCE_MESSAGES) return `A sequência pode ter no máximo ${INSTAGRAM_MAX_SEQUENCE_MESSAGES} mensagens`;
  if (input.triggerType === "comment" && input.steps.length > 1) {
    return "Comentários permitem uma única resposta privada; a sequência continua somente após uma resposta no Direct";
  }
  let cumulativeDelay = 0;
  for (let index = 0; index < input.steps.length; index += 1) {
    const step = input.steps[index];
    const text = typeof step.text === "string" ? step.text.trim() : "";
    const delay = Number(step.delayMinutes ?? 0);
    if (!text || text.length > 1000) return "Cada mensagem deve ter entre 1 e 1.000 caracteres";
    if (step.button) {
      let url: URL;
      try { url = new URL(String(step.button.url ?? "")); } catch { return "Informe um link válido para o botão"; }
      if (url.protocol !== "https:" || url.username || url.password || !String(step.button.label ?? "").trim() || String(step.button.label).length > 20) return "O botão precisa de um título curto e um link HTTPS seguro";
    }
    if (!Number.isFinite(delay) || delay < 0 || delay > 1380) return "O intervalo deve ficar entre 0 e 1.380 minutos";
    if (index > 0 && delay < 1) return "Aguarde ao menos 1 minuto entre mensagens consecutivas";
    cumulativeDelay += delay;
  }
  if (input.triggerType !== "comment" && cumulativeDelay > 1380) {
    return "A sequência precisa terminar dentro da janela de 24 horas do Instagram";
  }
  return null;
}

/**
 * Automations this event may start, in priority order. Comment automations
 * limited to posts only match comments on those posts, and run before the
 * "all posts" ones. "Any comment" is only allowed when limited to posts.
 */
type MatchableAutomation = { match_type: InstagramAutomationMatch; keywords: string[] | null; media_ids?: string[] | null };

export function eligibleAutomations<T extends MatchableAutomation>(automations: T[], event: Pick<NormalizedInstagramEvent, "eventType" | "text" | "mediaId">): T[] {
  const eligible = automations.filter(automation => {
    const mediaIds = automation.media_ids ?? [];
    if (event.eventType === "comment") {
      if (mediaIds.length && (!event.mediaId || !mediaIds.includes(event.mediaId))) return false;
      if (automation.match_type === "any" && !mediaIds.length) return false;
    }
    return matchesInstagramKeywords(event.text, automation.keywords ?? [], automation.match_type);
  });
  const scoped = (automation: T) => (event.eventType === "comment" && (automation.media_ids ?? []).length ? 0 : 1);
  return eligible.map((automation, index) => ({ automation, index }))
    .sort((a, b) => scoped(a.automation) - scoped(b.automation) || a.index - b.index)
    .map(item => item.automation);
}
