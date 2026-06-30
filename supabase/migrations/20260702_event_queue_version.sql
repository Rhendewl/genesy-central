-- ============================================================
-- domain_events_queue — schema refinements antes da Fase 4
--
-- Decisões:
--   1. aggregate_type / aggregate_id  — metadata de aggregate para
--      lookup indexado por entidade, event stream e dead-letter audit.
--      NOT NULL seguro: tabela está vazia até a ativação Phase 4.
--
--   2. event_version text → smallint  — elimina bug de ordenação
--      lexicográfica ('9' < '10' falha como texto, funciona como int).
--      USING clause converte '1' → 1; table is empty so no data risk.
--
--   3. status 'cancelled'             — distingue descarte deliberado
--      (regra de negócio) de falha técnica (dead_letter), evitando
--      falso-positivo em alertas de operações.
--
--   4. Índices:
--      (aggregate_type, aggregate_id) — event stream por entidade
--      (created_at DESC)              — queries operacionais / diagnóstico
--      (event_type, status) REJEITADO — worker usa index parcial existente;
--                                       baixo benefício vs custo de escrita.
-- ============================================================

-- ── 1. Aggregate metadata ──────────────────────────────────────
-- Colunas adicionadas em dois passos para suportar ambientes onde a
-- tabela possa ter dados (re-execução, recovery parcial):
--   a) ADD COLUMN nullable — seguro em qualquer tabela.
--   b) DO block de guarda — falha explícita se houver linhas sem backfill,
--      em vez de silenciosamente aceitar NULLs ou produzir dados inválidos.
--   c) SET NOT NULL — idempotente: no-op se o constraint já existir.

ALTER TABLE domain_events_queue
  ADD COLUMN IF NOT EXISTS aggregate_type text,
  ADD COLUMN IF NOT EXISTS aggregate_id   uuid;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM domain_events_queue
    WHERE aggregate_type IS NULL OR aggregate_id IS NULL
    LIMIT 1
  ) THEN
    RAISE EXCEPTION
      'domain_events_queue tem linhas sem aggregate_type/aggregate_id. '
      'Faça o backfill manual antes de prosseguir com esta migration.';
  END IF;
END;
$$;

ALTER TABLE domain_events_queue
  ALTER COLUMN aggregate_type SET NOT NULL,
  ALTER COLUMN aggregate_id   SET NOT NULL;

COMMENT ON COLUMN domain_events_queue.aggregate_type IS
  'Tipo do aggregate root: ''lead'', ''form'', ''pipeline'', etc.';
COMMENT ON COLUMN domain_events_queue.aggregate_id IS
  'UUID da instância do aggregate root (ex: leads.id para aggregate_type=''lead'').';

-- ── 2. event_version: text → smallint ─────────────────────────
-- Elimina ordenação lexicográfica incorreta ('9' > '10' como texto).
-- Condicional: se a coluna já for smallint (re-execução ou parcial prévia),
-- o bloco TYPE é pulado. SET DEFAULT 1 é sempre seguro em smallint.

DO $$
DECLARE
  col_type text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'domain_events_queue'
    AND column_name  = 'event_version';

  IF col_type = 'text' THEN
    ALTER TABLE domain_events_queue ALTER COLUMN event_version DROP DEFAULT;
    ALTER TABLE domain_events_queue ALTER COLUMN event_version TYPE smallint
      USING CASE WHEN event_version ~ '^\d+$' THEN event_version::smallint ELSE 1 END;
  END IF;
END;
$$;

ALTER TABLE domain_events_queue
  ALTER COLUMN event_version SET DEFAULT 1;

COMMENT ON COLUMN domain_events_queue.event_version IS
  'Versão do schema do payload. Bumpar ao alterar o shape de qualquer event_type. Workers devem falhar explicitamente (não silenciosamente) em versões desconhecidas.';

-- ── 3. Adiciona status 'cancelled' ────────────────────────────
-- Workers retornam "cancelled" quando uma regra de negócio determina
-- descarte deliberado (ex: lead deletado antes do processamento).
-- Diferente de dead_letter (falha técnica com retries esgotados).
-- Supabase auto-nomeia constraints inline como {table}_{col}_check.

ALTER TABLE domain_events_queue
  DROP CONSTRAINT IF EXISTS domain_events_queue_status_check;

ALTER TABLE domain_events_queue
  ADD CONSTRAINT domain_events_queue_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter', 'cancelled'));

-- ── 4. Índices ─────────────────────────────────────────────────

-- Event stream por entidade: "todos os eventos do lead X"
-- Dead-letter audit: "quais eventos falharam para este lead?"
CREATE INDEX IF NOT EXISTS domain_events_queue_aggregate_idx
  ON domain_events_queue (aggregate_type, aggregate_id);

-- Queries operacionais: "últimos N eventos em dead_letter"
-- A PK (uuid aleatória) não ordena por criação; process_after sofre
-- distorção por retry backoff — created_at é o único timestamp limpo.
CREATE INDEX IF NOT EXISTS domain_events_queue_created_at_idx
  ON domain_events_queue (created_at DESC);
