import type { EventBus, EventBusObserver } from "./types";

// ── Dev helpers ───────────────────────────────────────────────────────────────
// Utilitários de desenvolvimento — não incluir em produção.

/**
 * Exibe estatísticas do bus no console periodicamente.
 *
 * Uso:
 *   const stop = attachDevtools(bus);  // inicia logging a cada 5s
 *   stop();                            // para o logging
 *
 * Só funciona quando o bus foi criado com debug: true.
 */
export function attachDevtools(
  bus:              EventBus,
  intervalMs:       number = 5000,
): () => void {
  if (!bus.obs) {
    console.warn("[EventBus DevTools] O bus deve ser criado com debug: true.");
    return () => {};
  }

  const obs = bus.obs;

  console.info(`[EventBus DevTools] Monitorando bus "${bus.correlationId.slice(0, 8)}" a cada ${intervalMs}ms`);

  const timer = setInterval(() => {
    printSnapshot(obs);
  }, intervalMs);

  return () => clearInterval(timer);
}

/** Imprime um snapshot formatado no console. */
export function printSnapshot(obs: EventBusObserver): void {
  const snap = obs.snapshot();
  console.group("[EventBus] Snapshot");
  console.table({
    published:  snap.published,
    dispatched: snap.dispatched,
    dropped:    snap.dropped,
    failed:     snap.failed,
    queued:     snap.queued,
  });
  if (Array.isArray(snap.consumers) && snap.consumers.length > 0) {
    console.table(snap.consumers);
  }
  console.groupEnd();
}

/**
 * Instala um consumer de debug global que loga todos os eventos no console.
 *
 * Retorna função de unsubscribe.
 * Uso: const unsub = installDebugConsumer(bus);
 */
export function installDebugConsumer(bus: EventBus): () => void {
  return bus.subscribe({
    name:     "__debug__",
    priority: 3, // LOW
    events:   "*",
    handle(event) {
      console.debug(
        `[Bus Event] ${event.source}::${event.type} | corr=${event.correlationId.slice(0, 8)}`,
        event.payload,
      );
    },
  });
}
