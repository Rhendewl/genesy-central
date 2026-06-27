import type { StorageAdapter } from "./types";

// ── LocalStorageAdapter ───────────────────────────────────────────────────────

/**
 * Implementação padrão usando localStorage.
 *
 * SSR-safe: todas as operações verificam `typeof localStorage`.
 * QuotaExceededError é silenciado — o bus continua operando sem persistência.
 */
export class LocalStorageAdapter implements StorageAdapter {
  get(key: string): string | null {
    try {
      if (typeof localStorage === "undefined") return null;
      return localStorage.getItem(key);
    /* v8 ignore next 2 */
    } catch { return null; }
  }

  set(key: string, value: string): void {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(key, value);
      }
    /* v8 ignore next */
    } catch { /* QuotaExceeded — graceful degradation */ }
  }

  remove(key: string): void {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(key);
      }
    } catch {}
  }

  keys(prefix: string): string[] {
    try {
      if (typeof localStorage === "undefined") return [];
      const result: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k !== null && k.startsWith(prefix)) result.push(k);
      }
      return result;
    /* v8 ignore next 2 */
    } catch { return []; }
  }

  clear(prefix: string): void {
    const matched = this.keys(prefix);
    for (let i = 0; i < matched.length; i++) {
      this.remove(matched[i]);
    }
  }
}

// ── InMemoryAdapter ───────────────────────────────────────────────────────────

/**
 * Implementação em memória — não persiste entre sessões.
 *
 * Usos:
 *  - Testes unitários (sem efeitos colaterais em localStorage)
 *  - SSR / ambientes sem localStorage
 *  - Módulos que não precisam de persistência CRITICAL
 */
export class InMemoryAdapter implements StorageAdapter {
  private readonly store: Map<string, string> = new Map();

  get(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.store.set(key, value);
  }

  remove(key: string): void {
    this.store.delete(key);
  }

  keys(prefix: string): string[] {
    const result: string[] = [];
    this.store.forEach((_, k) => {
      if (k.startsWith(prefix)) result.push(k);
    });
    return result;
  }

  clear(prefix: string): void {
    const matched = this.keys(prefix);
    for (let i = 0; i < matched.length; i++) {
      this.store.delete(matched[i]);
    }
  }

  /** Utilitário de teste: tamanho total do store. */
  size(): number {
    return this.store.size;
  }
}
