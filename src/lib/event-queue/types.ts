// ─────────────────────────────────────────────────────────────────────────────
// Event Queue — Contratos da Fase 4
//
// Fila durável para processamento assíncrono de eventos de domínio.
// Complementa o EventBus in-memory (real-time / best-effort) com
// semântica at-least-once + retry + dead-letter.
//
// Fluxo Fase 4:
//   crm_move_lead (RPC, mesma transação)
//     └─ INSERT INTO domain_events_queue   ← persiste junto com o dado
//   Worker (cron / Edge Function — independente do request HTTP)
//     └─ SELECT FOR UPDATE SKIP LOCKED
//     └─ EventWorker.process(entry) → WorkerResult
//     └─ "completed"  → marca processado
//     └─ "cancelled"  → descarte deliberado por regra de negócio
//     └─ throw        → falha técnica, incrementa attempts / retry
//     └─ dead_letter  → após max_attempts esgotados
//
// correlation_id: nullable, populada na Fase 4 junto com a ativação do
// worker — requer threading do request UUID por MoveLeadOptions → RPC.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  LeadCreatedPayload,
  LeadUpdatedPayload,
  LeadDeletedPayload,
  LeadStageEnteredPayload,
  LeadStageLeftPayload,
} from "@/lib/event-bus/domain-events";

// ── Status ────────────────────────────────────────────────────────────────────
//
// Semântica intencional:
//   pending      — aguardando processamento
//   processing   — sendo processado por um worker (lock ativo)
//   completed    — processado com sucesso
//   failed       — tentativa falhou, haverá retry (attempts < max_attempts)
//   dead_letter  — falha técnica com retries esgotados — ALERTA de operações
//   cancelled    — descartado por decisão de negócio (ex: lead deletado antes
//                  do processamento) — NÃO deve acionar alertas de operações

export type QueueEventStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "dead_letter"
  | "cancelled";

// ── WorkerResult ──────────────────────────────────────────────────────────────
//
// Retorno explícito de EventWorker.process().
//   "completed"  → runner marca status='completed'
//   "cancelled"  → runner marca status='cancelled' (sem alarme)
//   throw        → runner trata como falha técnica (retry / dead_letter)

export type WorkerResult = "completed" | "cancelled";

// ── Base fields (shared by all queue entries) ─────────────────────────────────

interface QueueEntryBase {
  id:             string;
  // Aggregate root da entidade que gerou o evento.
  // Permite lookup indexado sem JSONB scanning:
  //   WHERE aggregate_type = 'lead' AND aggregate_id = ?
  aggregate_type: string;
  aggregate_id:   string;      // UUID como string (Supabase retorna uuid → string)
  source:         string;
  // Versão do schema do payload (smallint no DB).
  // Workers devem falhar explicitamente em versões desconhecidas,
  // nunca silenciosamente mal-interpretar um payload desatualizado.
  event_version:  number;
  correlation_id: string | null;
  status:         QueueEventStatus;
  attempts:       number;
  max_attempts:   number;
  process_after:  string;
  last_error:     string | null;
  created_at:     string;
  processed_at:   string | null;
}

// ── Typed entry helper ────────────────────────────────────────────────────────

type QueueEntry<TType extends string, TPayload> = QueueEntryBase & {
  event_type: TType;
  payload:    TPayload;
};

// ── Discriminated union — conjunto fechado de eventos de domínio conhecidos ───
//
// Após `if (entry.event_type === "lead.stage.entered")`, TypeScript estreita
// `entry.payload` para `LeadStageEnteredPayload` sem nenhum cast.
//
// Adicionar um novo event_type ao sistema requer adicionar um membro aqui.
// O compilador então expõe todos os workers que precisam de atualização.

export type DomainEventQueueEntry =
  | QueueEntry<"lead.created",       LeadCreatedPayload>
  | QueueEntry<"lead.updated",       LeadUpdatedPayload>
  | QueueEntry<"lead.deleted",       LeadDeletedPayload>
  | QueueEntry<"lead.stage.entered", LeadStageEnteredPayload>
  | QueueEntry<"lead.stage.left",    LeadStageLeftPayload>;

// ── Raw entry — para workers de passagem (audit, logging) ────────────────────
//
// Separado de DomainEventQueueEntry para não poluir a union discriminada
// com um fallback `string` que quebraria o narrowing do TypeScript.
// Workers registrados com events: "*" devem usar este tipo.

export interface RawDomainEventQueueEntry extends QueueEntryBase {
  event_type: string;
  payload:    Record<string, unknown>;
}

// ── Worker ────────────────────────────────────────────────────────────────────

export interface EventWorker {
  readonly name:   string;
  readonly events: ReadonlyArray<string> | "*";
  process(entry: DomainEventQueueEntry): Promise<WorkerResult>;
}

// ── Runner config ─────────────────────────────────────────────────────────────

export interface EventQueueConfig {
  batchSize:    number;
  backoffMs:    number;    // base; delay efetivo = backoffMs * 2^(attempts-1)
  maxBackoffMs: number;
}

// ── Write helpers ─────────────────────────────────────────────────────────────
//
// Para escritas TypeScript-side na fila (testes, edge cases).
// A maioria das escritas vem do RPC crm_move_lead — esse tipo é auxiliar.
// aggregate_type e aggregate_id são obrigatórios (NOT NULL no DB).

export interface EnqueueEventInput {
  event_type:      string;
  aggregate_type:  string;
  aggregate_id:    string;
  payload:         Record<string, unknown>;
  event_version?:  number;
  source?:         string;
  correlation_id?: string;
  max_attempts?:   number;
  process_after?:  Date;
}
