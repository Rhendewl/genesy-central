import type { BusEvent, MiddlewareFn } from "./types";

// ── Pipeline ──────────────────────────────────────────────────────────────────

/**
 * Aplica a cadeia de middlewares a um evento.
 *
 * Retorna null se qualquer middleware retornar null (evento descartado).
 * Retorna o evento transformado (possivelmente o mesmo) após todos os middlewares.
 */
export function applyMiddlewares(
  event:       BusEvent,
  middlewares: ReadonlyArray<MiddlewareFn>,
): BusEvent | null {
  let current: BusEvent | null = event;
  for (let i = 0; i < middlewares.length; i++) {
    if (current === null) return null;
    current = middlewares[i](current);
  }
  return current;
}

// ── Built-in middlewares ───────────────────────────────────────────────────────
// Prontos para uso. Registre via bus.use() ou via EventBusConfig.middlewares.

/**
 * Enriquece cada evento com a URL atual do browser.
 * No-op em SSR.
 */
export const urlEnrichMiddleware: MiddlewareFn = (event) => {
  if (typeof window === "undefined") return event;
  return {
    ...event,
    meta: { ...event.meta, url: window.location.href, referrer: document.referrer || undefined },
  };
};

/**
 * Remove propriedades null e undefined do payload quando ele for um objeto.
 * Útil para normalização antes de enviar ao servidor.
 */
export const stripNullsMiddleware: MiddlewareFn = (event) => {
  if (typeof event.payload !== "object" || event.payload === null) return event;
  const cleaned: Record<string, unknown> = {};
  const payload = event.payload as Record<string, unknown>;
  const keys = Object.keys(payload);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (payload[k] != null) cleaned[k] = payload[k];
  }
  return { ...event, payload: cleaned };
};

/**
 * Middleware de desenvolvimento — loga cada evento no console com timestamp.
 * Não modifica o evento.
 */
export const debugLogMiddleware: MiddlewareFn = (event) => {
  const ts = new Date(event.timestamp).toISOString().slice(11, 23);
  console.debug(`[Bus ${ts}] ${event.source}::${event.type}`, event.payload);
  return event;
};
