export const CLIENT_NAME_TOKEN = "{{cliente}}";

const CLIENT_TOKEN_PATTERN = /\{\{\s*(cliente|client|nome_cliente|client_name)\s*\}\}/gi;

export function renderOnboardingTaskTitle(title: string, clientName?: string | null): string {
  const replacement = clientName?.trim() || "Cliente";
  return title.replace(CLIENT_TOKEN_PATTERN, replacement);
}

export function appendClientNameToken(title: string): string {
  const trimmed = title.trimEnd();
  CLIENT_TOKEN_PATTERN.lastIndex = 0;
  if (CLIENT_TOKEN_PATTERN.test(trimmed)) return title;
  return `${trimmed}${trimmed ? " " : ""}${CLIENT_NAME_TOKEN}`;
}
