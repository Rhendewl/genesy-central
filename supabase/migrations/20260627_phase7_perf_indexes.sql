-- =============================================================================
-- Lancaster SaaS — Phase 7: Performance Indexes & Stats RPC
-- Applied after: 20260626_phase7_responses_center.sql
-- =============================================================================
--
-- CONTEXTO
--   Sem estes índices compostos, GET /api/respostas usa o índice simples
--   (user_id) criado em 20260625, depois filtra archived em memória e
--   faz um sort adicional. Com 100k rows isso é O(n log n).
--
--   Com os índices compostos abaixo:
--   • A query usa apenas o índice para filtrar E ordenar.
--   • LIMIT 51 para após examinar 51 entradas do índice → O(1) efetivo.
--
--   A função get_submission_stats substitui 3 COUNT(*) paralelos por
--   1 único aggregate pass — 3× menos scans, 2 round-trips a menos.
--
-- IDEMPOTÊNCIA
--   • CREATE INDEX IF NOT EXISTS
--   • CREATE OR REPLACE FUNCTION
--
-- =============================================================================

BEGIN;

-- =============================================================================
-- ÍNDICES — form_submissions
-- =============================================================================

-- ── 1. Visão "todos os formulários" (sem form_id filter) ─────────────────────
--
-- Query: WHERE user_id = $1 AND archived = $2
--        ORDER BY created_at DESC, id DESC LIMIT 51
--
-- Plano esperado:
--   Index Scan using form_submissions_user_archived_cursor_idx
--     Index Cond: (user_id = $1 AND archived = $2)
--     Limit: 51 rows — para imediatamente após encontrar 51 entradas
--
-- Substitui: Index Scan(user_id_idx) + Filter(archived) + Sort O(n log n)

CREATE INDEX IF NOT EXISTS form_submissions_user_archived_cursor_idx
  ON form_submissions(user_id, archived, created_at DESC, id DESC);

-- ── 2. Visão "formulário específico" (com form_id filter) ────────────────────
--
-- Query: WHERE user_id = $1 AND form_id = $2 AND archived = $3
--        ORDER BY created_at DESC, id DESC LIMIT 51
--
-- Plano esperado:
--   Index Scan using form_submissions_user_form_archived_cursor_idx
--     Index Cond: (user_id = $1 AND form_id = $2 AND archived = $3)
--     Limit: 51 rows
--
-- Substitui: Index Scan(archived_idx: form_id, archived) + Filter(user_id) + Sort

CREATE INDEX IF NOT EXISTS form_submissions_user_form_archived_cursor_idx
  ON form_submissions(user_id, form_id, archived, created_at DESC, id DESC);

-- ── 3. Filtro por status (sem form_id) ───────────────────────────────────────
--
-- Query: WHERE user_id = $1 AND archived = $2 AND status = $3
--        ORDER BY created_at DESC, id DESC LIMIT 51
--
-- Cobre o caso comum de filtrar por status='completed' ou 'abandoned'
-- sem precisar de um form_id específico.

CREATE INDEX IF NOT EXISTS form_submissions_user_archived_status_cursor_idx
  ON form_submissions(user_id, archived, status, created_at DESC, id DESC);

-- ── 4. Sort por completed_at ──────────────────────────────────────────────────
--
-- Query: WHERE user_id = $1 AND archived = $2
--        ORDER BY completed_at DESC NULLS LAST, id DESC LIMIT 51
--
-- Sem índice, requer sort O(n log n) sobre todas as rows do usuário.
-- NULLS LAST porque submissions em andamento têm completed_at = NULL.

CREATE INDEX IF NOT EXISTS form_submissions_user_archived_completed_cursor_idx
  ON form_submissions(user_id, archived, completed_at DESC NULLS LAST, id DESC);

-- =============================================================================
-- ÍNDICES — integration_deliveries
-- =============================================================================

-- ── 5. Query de detail: WHERE form_id = $1 AND correlation_id = $2 ───────────
--
-- Índice existente: (correlation_id) — single column, sem form_id.
-- O planner não pode aplicar o filtro form_id via este índice.
--
-- Plano atual: Index Scan(correlation_idx) + Filter(form_id = $1)
-- Plano com novo índice:
--   Index Scan using integration_deliveries_form_corr_delivered_idx
--     Index Cond: (form_id = $1 AND correlation_id = $2)
--     Order By: delivered_at ASC (já na ordem certa — sem sort extra)
--
-- form_id antes de correlation_id:
--   • Selectividade de form_id é alta (um form tem poucos deliveries)
--   • correlation_id é ainda mais seletivo, confirma em O(1)
--   • Evita scan de deliveries de outros forms para a mesma correlation_id

CREATE INDEX IF NOT EXISTS integration_deliveries_form_corr_delivered_idx
  ON integration_deliveries(form_id, correlation_id, delivered_at ASC);

-- =============================================================================
-- RPC — get_submission_stats
-- =============================================================================
-- Substitui 3 COUNT(*) paralelos por 1 aggregate em single pass.
--
-- ANTES (3 queries paralelas = 3 round-trips, 3 index scans):
--   COUNT(*) WHERE user_id = $1 AND archived = $2
--   COUNT(*) WHERE user_id = $1 AND archived = $2 AND status = 'completed'
--   COUNT(*) WHERE user_id = $1 AND archived = $2 AND status IN (...)
--
-- DEPOIS (1 query = 1 round-trip, 1 index scan):
--   SELECT COUNT(*), COUNT(*) FILTER (...), COUNT(*) FILTER (...)
--   WHERE user_id = $1 AND archived = $2 [AND form_id = $3]
--
-- SECURITY INVOKER (default): executa com o role do caller.
--   O usuário autenticado tem RLS aplicada → auth.uid() = user_id.
--   O filtro explícito WHERE user_id = p_user_id é redundante com RLS
--   mas garante segurança mesmo se RLS mudar.
--
-- STABLE: sem side-effects; resultados consistentes dentro da transação.
--   Permite cache pelo planner se chamada múltiplas vezes com mesmos args.
--
-- PARALLEL SAFE: pode ser executada em parallel workers do PostgreSQL.
--   COUNT com agregados condicionais é safe (não usa cursores globais).

CREATE OR REPLACE FUNCTION get_submission_stats(
  p_user_id  UUID,
  p_archived BOOLEAN,
  p_form_id  UUID DEFAULT NULL
)
RETURNS TABLE(
  total     BIGINT,
  completed BIGINT,
  abandoned BIGINT
)
LANGUAGE sql STABLE PARALLEL SAFE
AS $$
  SELECT
    COUNT(*)                                                    AS total,
    COUNT(*) FILTER (WHERE status = 'completed')               AS completed,
    COUNT(*) FILTER (WHERE status IN ('abandoned', 'partial')) AS abandoned
  FROM form_submissions
  WHERE user_id  = p_user_id
    AND archived = p_archived
    AND (p_form_id IS NULL OR form_id = p_form_id)
$$;

COMMENT ON FUNCTION get_submission_stats(UUID, BOOLEAN, UUID) IS
  'Computes total/completed/abandoned submission counts in a single aggregate pass. '
  'Called by GET /api/respostas. Replaces 3 separate COUNT queries. '
  'Stats intentionally exclude status/starred filters — reflect overall form health.';

-- =============================================================================
-- ÍNDICES — form_events
-- =============================================================================

-- ── 6. Timeline da sessão sem Sort ───────────────────────────────────────────
--
-- Índice existente: form_events_session_seq_idx (session_id, created_at ASC)
--   WHERE session_id IS NOT NULL (parcial)
--
-- O planner prefere Bitmap Heap Scan no índice parcial porque a condição WHERE
-- impede o uso como Index Scan com preservação de ordem → Sort residual.
--
-- Este índice não-parcial permite Index Scan diretamente ordenado:
--   Index Scan using form_events_session_created_asc_idx
--     Index Cond: (session_id = $1)
--     Order By: created_at ASC   ← coberto, sem Sort
--
-- Substituição: o índice parcial existente permanece (coberto por IF NOT EXISTS);
-- o planner escolherá o mais eficiente dependendo dos dados.

CREATE INDEX IF NOT EXISTS form_events_session_created_asc_idx
  ON form_events(session_id, created_at ASC);

-- =============================================================================
-- FIM
-- =============================================================================

COMMIT;
