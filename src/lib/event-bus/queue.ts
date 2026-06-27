import type { BusEvent, StorageAdapter } from "./types";

// ── Constants ─────────────────────────────────────────────────────────────────

const QUEUE_PREFIX  = "genesy_bus_q_";
const TTL_MS        = 24 * 60 * 60 * 1000; // 24 horas
const MAX_QUEUE_SIZE = 100;                 // oldest-first eviction ao atingir o limite

// ── Stored shape ──────────────────────────────────────────────────────────────

interface QueueEntry {
  event:       BusEvent;
  consumerName: string;
  attempts:    number;
  expiresAt:   number;
}

// ── PersistentQueue ───────────────────────────────────────────────────────────

/**
 * Fila persistente de eventos CRITICAL que falharam todos os retries em memória.
 *
 * Usa StorageAdapter — pode ser localStorage, IndexedDB, memória, etc.
 * Entradas expiram após 24h (TTL_MS).
 * Ao atingir MAX_QUEUE_SIZE, a entrada mais antiga é removida (eviction).
 *
 * Não bloqueia: todas as operações são síncronas (compatível com beforeunload).
 */
export class PersistentQueue {
  constructor(
    private readonly storage: StorageAdapter,
    private readonly source:  string,
  ) {}

  private entryKey(eventId: string, consumerName: string): string {
    return `${QUEUE_PREFIX}${this.source}_${consumerName}_${eventId}`;
  }

  private prefix(): string {
    return `${QUEUE_PREFIX}${this.source}_`;
  }

  /** Persiste uma entrada na fila. Evicts a mais antiga se necessário. */
  enqueue(event: BusEvent, consumerName: string, attempts: number): void {
    const keys = this.storage.keys(this.prefix());

    // Evict oldest entry when at capacity
    if (keys.length >= MAX_QUEUE_SIZE) {
      let oldestKey: string | null  = null;
      let oldestTs = Infinity;

      for (let i = 0; i < keys.length; i++) {
        try {
          const raw = this.storage.get(keys[i]);
          if (!raw) continue;
          const entry = JSON.parse(raw) as QueueEntry;
          if (entry.event.timestamp < oldestTs) {
            oldestTs  = entry.event.timestamp;
            oldestKey = keys[i];
          }
        } catch { /* corrupt entry — skip */ }
      }

      if (oldestKey) this.storage.remove(oldestKey);
    }

    const entry: QueueEntry = {
      event,
      consumerName,
      attempts,
      expiresAt: Date.now() + TTL_MS,
    };
    this.storage.set(this.entryKey(event.id, consumerName), JSON.stringify(entry));
  }

  /** Retorna entradas elegíveis para retry para o consumer dado. Expira TTL. */
  dequeue(consumerName: string): QueueEntry[] {
    const prefix = this.prefix();
    const keys   = this.storage.keys(prefix);
    const now    = Date.now();
    const result: QueueEntry[] = [];

    for (let i = 0; i < keys.length; i++) {
      try {
        const raw = this.storage.get(keys[i]);
        if (!raw) continue;
        const entry = JSON.parse(raw) as QueueEntry;

        // Remove expired entries
        if (entry.expiresAt < now) {
          this.storage.remove(keys[i]);
          continue;
        }

        if (entry.consumerName === consumerName) {
          result.push(entry);
        }
      } catch {
        this.storage.remove(keys[i]); // corrupt entry
      }
    }

    // Sort by original event timestamp (FIFO)
    return result.sort((a, b) => a.event.timestamp - b.event.timestamp);
  }

  /** Remove uma entrada após processamento bem-sucedido. */
  acknowledge(eventId: string, consumerName: string): void {
    this.storage.remove(this.entryKey(eventId, consumerName));
  }

  /** Número total de entradas na fila (todos os consumers). */
  size(): number {
    return this.storage.keys(this.prefix()).length;
  }

  /** Remove toda a fila deste source. */
  clear(): void {
    this.storage.clear(this.prefix());
  }
}
