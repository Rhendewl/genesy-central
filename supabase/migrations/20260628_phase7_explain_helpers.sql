-- =============================================================================
-- Lancaster SaaS — Diagnóstico: EXPLAIN ANALYZE helpers
-- Aplicar APÓS: 20260627_phase7_perf_indexes.sql
-- Remover após diagnóstico: DROP FUNCTION _diag_explain_*
-- =============================================================================
-- Uso: scripts/explain-queries.mjs [user_uuid]
--   node --input-type=module < scripts/explain-queries.mjs
--   npx tsx scripts/explain-queries.mjs <user_id>
-- =============================================================================

BEGIN;

-- ── Q1: List — todos os formulários ──────────────────────────────────────────
-- Valida: form_submissions_user_archived_cursor_idx
-- Esperado: Index Scan (NO Sort, NO Seq Scan)

CREATE OR REPLACE FUNCTION _diag_explain_list_all_forms(
  p_user_id  UUID,
  p_archived BOOLEAN DEFAULT false
)
RETURNS SETOF TEXT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE r TEXT; BEGIN
  FOR r IN
    EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
    SELECT id, form_id, session_id, correlation_id, status, answers, score,
           step_timings, drop_off_step, time_on_form_ms, read_at, starred,
           archived, completed_at, created_at, updated_at
    FROM form_submissions
    WHERE user_id = p_user_id AND archived = p_archived
    ORDER BY created_at DESC, id DESC
    LIMIT 51
  LOOP RETURN NEXT r; END LOOP;
END;
$$;

-- ── Q2: List — formulário específico ─────────────────────────────────────────
-- Valida: form_submissions_user_form_archived_cursor_idx
-- Esperado: Index Scan (NO Sort, NO Seq Scan)

CREATE OR REPLACE FUNCTION _diag_explain_list_by_form(
  p_user_id  UUID,
  p_form_id  UUID,
  p_archived BOOLEAN DEFAULT false
)
RETURNS SETOF TEXT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE r TEXT; BEGIN
  FOR r IN
    EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
    SELECT id, form_id, session_id, correlation_id, status, answers, score,
           step_timings, drop_off_step, time_on_form_ms, read_at, starred,
           archived, completed_at, created_at, updated_at
    FROM form_submissions
    WHERE user_id = p_user_id AND form_id = p_form_id AND archived = p_archived
    ORDER BY created_at DESC, id DESC
    LIMIT 51
  LOOP RETURN NEXT r; END LOOP;
END;
$$;

-- ── Q3: Stats RPC — aggregate condicional em single pass ─────────────────────
-- Valida: form_submissions_user_archived_cursor_idx (para COUNT)
-- Esperado: Aggregate → Index Scan (NO Sort, NO Seq Scan)

CREATE OR REPLACE FUNCTION _diag_explain_stats(
  p_user_id  UUID,
  p_archived BOOLEAN DEFAULT false,
  p_form_id  UUID DEFAULT NULL
)
RETURNS SETOF TEXT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE r TEXT; BEGIN
  FOR r IN
    EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
    SELECT
      COUNT(*)                                                    AS total,
      COUNT(*) FILTER (WHERE status = 'completed')               AS completed,
      COUNT(*) FILTER (WHERE status IN ('abandoned', 'partial')) AS abandoned
    FROM form_submissions
    WHERE user_id  = p_user_id
      AND archived = p_archived
      AND (p_form_id IS NULL OR form_id = p_form_id)
  LOOP RETURN NEXT r; END LOOP;
END;
$$;

-- ── Q4: integration_deliveries — detalhe da submission ───────────────────────
-- Valida: integration_deliveries_form_corr_delivered_idx
-- Esperado: Index Scan com Order By coberto (NO Sort extra)

CREATE OR REPLACE FUNCTION _diag_explain_deliveries(
  p_form_id        UUID,
  p_correlation_id TEXT
)
RETURNS SETOF TEXT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE r TEXT; BEGIN
  FOR r IN
    EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
    SELECT id, adapter_name, event_id, correlation_id, event_type,
           attempt, ok, status_code, duration_ms, error, delivered_at
    FROM integration_deliveries
    WHERE form_id = p_form_id AND correlation_id = p_correlation_id
    ORDER BY delivered_at ASC
  LOOP RETURN NEXT r; END LOOP;
END;
$$;

-- ── Q5: form_events — timeline da sessão ─────────────────────────────────────
-- Valida: índice existente em form_events(session_id, created_at)
-- Esperado: Index Scan (Sort presente — form_events_created_at_idx é DESC,
--           não cobre ORDER BY ASC sem composite index)
-- Nota: meta e idempotency_key só existem após 20260626_analytics_events.sql

CREATE OR REPLACE FUNCTION _diag_explain_events(
  p_session_id UUID
)
RETURNS SETOF TEXT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE r TEXT; BEGIN
  FOR r IN
    EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
    SELECT id, step_id, event, duration, created_at
    FROM form_events
    WHERE session_id = p_session_id
    ORDER BY created_at ASC
  LOOP RETURN NEXT r; END LOOP;
END;
$$;

-- =============================================================================
-- INSTRUÇÕES DE LIMPEZA (rodar no SQL Editor após coletar o diagnóstico)
-- =============================================================================
-- DROP FUNCTION IF EXISTS _diag_explain_list_all_forms(UUID, BOOLEAN);
-- DROP FUNCTION IF EXISTS _diag_explain_list_by_form(UUID, UUID, BOOLEAN);
-- DROP FUNCTION IF EXISTS _diag_explain_stats(UUID, BOOLEAN, UUID);
-- DROP FUNCTION IF EXISTS _diag_explain_deliveries(UUID, TEXT);
-- DROP FUNCTION IF EXISTS _diag_explain_events(UUID);

COMMIT;
