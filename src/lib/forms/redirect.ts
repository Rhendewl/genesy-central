/**
 * Normaliza URLs configuradas pelo usuário para redirecionamento público.
 * Aceita domínios sem protocolo, mas bloqueia esquemas executáveis como
 * javascript:, data: e file:.
 */
export function normalizeFormRedirectUrl(rawUrl?: string | null): string | null {
  const value = rawUrl?.trim();
  if (!value) return null;

  const candidate = /^[a-z][a-z\d+.-]*:/i.test(value)
    ? value
    : `https://${value}`;

  try {
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname) return null;
    return url.toString();
  } catch {
    return null;
  }
}
