// ─────────────────────────────────────────────────────────────────────────────
// Genesy Event Bus — Core Types
//
// Plataforma-agnóstico: utilizável por Form, CRM, Financeiro, Criativos,
// IA e Portais sem nenhuma alteração.
//
// Zero dependências de React, browser, Supabase ou módulos específicos.
// ─────────────────────────────────────────────────────────────────────────────

// ── Event ─────────────────────────────────────────────────────────────────────

/** Metadados de contexto incluídos em todos os eventos. Extensível por módulo. */
export interface EventMeta {
  readonly url?:      string;
  readonly referrer?: string;
  readonly device?:   string;
  readonly browser?:  string;
  readonly os?:       string;
  readonly utm?: Readonly<{
    source?:   string;
    medium?:   string;
    campaign?: string;
    term?:     string;
    content?:  string;
  }>;
  /** Campos extras definidos por cada módulo — sem quebrar o contrato base. */
  readonly [key: string]: unknown;
}

/**
 * Evento canônico da plataforma Genesy.
 *
 * Genérico para type safety no publish(), mas armazenado como BusEvent<string>
 * em arrays internos para compatibilidade com múltiplos módulos.
 *
 * TType   — discriminador: "form.started" | "crm.lead.created" | ...
 * TPayload — dados do evento, inferidos pelo caller via PayloadMap do módulo.
 */
export interface BusEvent<
  TType   extends string = string,
  TPayload               = unknown,
> {
  /** UUID v4 — deduplicação server-side e idempotência. */
  readonly id:            string;
  readonly type:          TType;
  /**
   * Identificador de jornada.
   * Compartilhado por todos os eventos de uma mesma sessão/fluxo do usuário.
   * Permite correlacionar eventos cross-módulo (ex: form.completed → crm.lead.created).
   */
  readonly correlationId: string;
  /** Módulo de origem: "form" | "crm" | "financial" | "traffic" | "creative" | "ai" | "portal". */
  readonly source:        string;
  readonly timestamp:     number;   // Date.now()
  readonly payload:       TPayload;
  readonly meta:          Readonly<EventMeta>;
}

// ── Consumer ──────────────────────────────────────────────────────────────────

/** Prioridade de execução dos consumidores. Menor número = executa primeiro. */
export enum ConsumerPriority {
  CRITICAL = 0, // Webhooks, CRM — perda de evento é inaceitável
  HIGH     = 1, // Analytics interno — deve persistir
  NORMAL   = 2, // GA4, Meta Pixel — best-effort com retry
  LOW      = 3, // Debug / telemetria — fire-and-forget
}

export interface RetryConfig {
  /** Total de tentativas incluindo a primeira. */
  readonly maxAttempts: number;
  /** Delay base em ms. Multiplicado pelo número da tentativa (backoff linear). */
  readonly backoffMs:   number;
  /**
   * Se true, eventos que esgotaram as tentativas são persistidos via StorageAdapter
   * para retry cross-session (ex: ao reconectar).
   */
  readonly persist:     boolean;
}

/**
 * Contrato de consumidor — interface pública que todos os consumers implementam.
 *
 * Usa BusEvent não-genérico (string/unknown) para compatibilidade com arrays
 * mistos de consumers de diferentes módulos.
 * Type safety é aplicada no factory do consumer via payload casting.
 */
export interface EventConsumer {
  /** Identificador único — usado em observabilidade e relatórios. */
  readonly name:     string;
  readonly priority: ConsumerPriority;
  /**
   * Tipos de evento que este consumer recebe.
   * "*" = recebe todos os eventos (útil para logging, debug).
   */
  readonly events:   ReadonlyArray<string> | "*";
  handle(event: BusEvent): Promise<void> | void;
  readonly retry?:   RetryConfig;
}

// ── Middleware ─────────────────────────────────────────────────────────────────

/**
 * Função de middleware executada entre publish() e os consumers.
 *
 * Retorna:
 *  - BusEvent (possivelmente transformado) → pipeline continua
 *  - null → evento descartado, nenhum consumer é notificado
 *
 * Casos de uso: enriquecimento, normalização, validação de schema,
 * anonimização de PII, feature flags, rate limiting.
 *
 * Middlewares NÃO conhecem consumers — apenas transformam o evento.
 * Consumers NÃO conhecem middlewares — apenas recebem o evento final.
 */
export type MiddlewareFn = (event: BusEvent) => BusEvent | null;

// ── Storage Adapter ───────────────────────────────────────────────────────────

/**
 * Abstração de armazenamento para fila persistente de eventos CRITICAL.
 *
 * Implementações disponíveis em storage.ts:
 *  - LocalStorageAdapter (padrão)
 *  - InMemoryAdapter (testes, SSR)
 *
 * Pode ser substituída por IndexedDB, Redis, Service Worker Cache
 * sem alterar o Event Bus.
 */
export interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  /** Retorna todas as chaves que começam com o prefixo dado. */
  keys(prefix: string): string[];
  /** Remove todas as entradas cujas chaves começam com o prefixo. */
  clear(prefix: string): void;
}

// ── Publish ───────────────────────────────────────────────────────────────────

export interface PublishInput<TType extends string = string> {
  readonly type:           TType;
  readonly payload?:       unknown;
  /** Sobrescreve o correlationId para este evento específico. */
  readonly correlationId?: string;
}

// ── Event Bus Config ──────────────────────────────────────────────────────────

export interface EventBusConfig<TType extends string = string> {
  /**
   * Identificador do módulo — preenchido automaticamente no campo `source`
   * de cada evento publicado.
   */
  readonly source:          string;
  /**
   * Identificador de jornada compartilhado por todos os eventos desta instância.
   * Gerado automaticamente via UUID v4 se não fornecido.
   */
  readonly correlationId?:  string;
  /** Metadados base mesclados em `meta` de cada evento. */
  readonly meta?:           Partial<EventMeta>;
  readonly consumers?:      ReadonlyArray<EventConsumer>;
  readonly middlewares?:    ReadonlyArray<MiddlewareFn>;
  readonly storage?:        StorageAdapter;
  /**
   * Ativa logging no console e popula `bus.obs`.
   * Deve ser false em produção.
   */
  readonly debug?:          boolean;
}

// ── Event Bus Interface ───────────────────────────────────────────────────────

export interface EventBus<TType extends string = string> {
  /**
   * Publica um único evento.
   * Retorna imediatamente — despacho é assíncrono e fire-and-forget.
   */
  publish(type: TType, payload?: unknown): void;

  /**
   * Publica múltiplos eventos em ordem de inserção.
   * Retorna imediatamente — despacho é assíncrono e fire-and-forget.
   */
  publishBatch(events: ReadonlyArray<PublishInput<TType>>): void;

  /**
   * Registra um consumer dinamicamente (pós-criação do bus).
   * Retorna função de unsubscribe.
   */
  subscribe(consumer: EventConsumer): () => void;

  /**
   * Adiciona um middleware ao final do pipeline.
   * Middlewares são executados na ordem em que foram adicionados.
   * Retorna função de remoção.
   */
  use(middleware: MiddlewareFn): () => void;

  /**
   * Tenta reprocessar eventos CRITICAL que falharam e estão na fila persistente.
   * Chamar quando a conexão for restaurada (online event).
   */
  flush(): Promise<void>;

  /**
   * Remove todos os consumers e middlewares, cancela operações pendentes.
   * Deve ser chamado no cleanup do componente que criou o bus.
   */
  destroy(): void;

  /** correlationId desta instância — compartilhar entre instâncias para cross-módulo. */
  readonly correlationId: string;

  /**
   * Módulo de observabilidade.
   * Disponível apenas quando `debug: true` na configuração.
   * undefined em produção (zero overhead).
   */
  readonly obs?: EventBusObserver;
}

// ── Observability ─────────────────────────────────────────────────────────────

export interface ConsumerStat {
  readonly name:       string;
  readonly dispatched: number;
  readonly succeeded:  number;
  readonly failed:     number;
  readonly retried:    number;
}

export interface EventBusObserver {
  /** Eventos publicados (antes do middleware). */
  readonly published:    number;
  /** Eventos despachados para ao menos um consumer (após middleware). */
  readonly dispatched:   number;
  /** Eventos descartados pelo pipeline de middleware. */
  readonly dropped:      number;
  /** Falhas totais de consumers (após esgotar retries). */
  readonly failed:       number;
  /** Eventos na fila persistente aguardando retry. */
  readonly queued:       number;
  /** Estatísticas por consumer. */
  readonly consumers:    ReadonlyArray<ConsumerStat>;
  /** Últimos N eventos publicados (somente em debug). */
  readonly recentEvents: ReadonlyArray<BusEvent>;
  /** Zera todos os contadores. */
  reset(): void;
  /** Retorna um snapshot serializável (útil para logging). */
  snapshot(): Record<string, unknown>;
}
