-- ─────────────────────────────────────────────────────────────────────────────
-- Analytics Events — Fase 4
--
-- 1. Expande CHECK constraint em form_events para todos os 28 event names
-- 2. Adiciona coluna meta JSONB para contexto extra por evento
-- 3. Adiciona idempotency_key para deduplicação
-- 4. Adiciona steps_completed em form_sessions para cálculo de avg_completion
-- 5. Adiciona city em form_sessions (preparado para geo — sem implementação)
--
-- Idempotente: pode ser executado múltiplas vezes sem erros.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. form_events — remover constraint antiga e recriar com novos eventos ───

ALTER TABLE form_events
  DROP CONSTRAINT IF EXISTS form_events_event_check;

ALTER TABLE form_events
  ADD CONSTRAINT form_events_event_check CHECK (event IN (
    -- ── Sessão ──────────────────────────────────────────────────────────────
    'page_loaded',
    'session_started',
    'session_resumed',
    'session_completed',
    'session_timeout',
    -- ── Welcome ─────────────────────────────────────────────────────────────
    'welcome_view',
    'welcome_started',
    -- ── Navegação ───────────────────────────────────────────────────────────
    'step_view',
    'step_completed',
    'back_clicked',
    'step_skipped',
    'validation_error',
    -- ── Respostas ────────────────────────────────────────────────────────────
    'answer_changed',
    'answer_cleared',
    'answer_restored',
    -- ── Lógica ──────────────────────────────────────────────────────────────
    'rule_matched',
    'rule_not_matched',
    'jump_executed',
    'ending_reached',
    'redirect_executed',
    'logic_executed',
    -- ── Formulário ──────────────────────────────────────────────────────────
    'submission_started',
    'submission_finished',
    'abandoned',
    'restart',
    'form_error',
    -- ── Legado (mantidos para compatibilidade) ──────────────────────────────
    'booking_started',
    'booking_finished'
  ));

-- ── 2. form_events — meta JSONB ─────────────────────────────────────────────

ALTER TABLE form_events
  ADD COLUMN IF NOT EXISTS meta JSONB;

-- ── 3. form_events — idempotency_key para deduplicação ──────────────────────

ALTER TABLE form_events
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- O índice UNIQUE ignora NULLs — eventos sem idempotency_key nunca conflitam.
CREATE UNIQUE INDEX IF NOT EXISTS form_events_idempotency_key_idx
  ON form_events(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ── 4. form_sessions — steps_completed para avg_completion ──────────────────

ALTER TABLE form_sessions
  ADD COLUMN IF NOT EXISTS steps_completed INTEGER NOT NULL DEFAULT 0;

-- ── 5. form_sessions — city (preparado para geolocalização futura) ───────────

ALTER TABLE form_sessions
  ADD COLUMN IF NOT EXISTS city TEXT;

-- ── Índices adicionais para queries de analytics ─────────────────────────────

CREATE INDEX IF NOT EXISTS form_events_meta_idx
  ON form_events USING GIN (meta)
  WHERE meta IS NOT NULL;

CREATE INDEX IF NOT EXISTS form_sessions_city_idx
  ON form_sessions(city)
  WHERE city IS NOT NULL;
