export const INSTAGRAM_STANDARD_WINDOW_MINUTES = 24 * 60;
export const INSTAGRAM_PRIVATE_REPLY_WINDOW_MINUTES = 7 * 24 * 60;
export const INSTAGRAM_MAX_SEQUENCE_MESSAGES = 5;
export const INSTAGRAM_AUTOMATION_HOURLY_LIMIT = 30;
export const INSTAGRAM_AUTOMATION_DAILY_LIMIT = 200;
export const INSTAGRAM_CONTACT_DAILY_LIMIT = 5;

const OPT_OUT_COMMANDS = new Set([
  "parar", "pare", "sair", "stop", "cancelar", "cancele", "descadastrar",
  "nao quero mais", "não quero mais",
]);

function normalizeCommand(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isInstagramOptOut(text: string) {
  return OPT_OUT_COMMANDS.has(normalizeCommand(text));
}

export function instagramActionDeadline(eventType: string, occurredAt: string) {
  const occurred = new Date(occurredAt).getTime();
  if (!Number.isFinite(occurred)) return null;
  const minutes = eventType === "comment"
    ? INSTAGRAM_PRIVATE_REPLY_WINDOW_MINUTES
    : INSTAGRAM_STANDARD_WINDOW_MINUTES;
  return new Date(occurred + minutes * 60_000);
}

export function isInstagramActionWithinWindow(eventType: string, occurredAt: string, now = new Date()) {
  const deadline = instagramActionDeadline(eventType, occurredAt);
  return Boolean(deadline && now.getTime() <= deadline.getTime());
}
