-- ============================================================
-- Phase 1 Fixes — critical review corrections
--
-- 1. crm_move_lead v2: search_path explícito, is_active check,
--    require_note removido da função (regra de negócio pertence ao
--    LeadService, não ao RPC).
--
-- 2. domain_events_queue: tabela da fila durável para a Fase 4.
--    Criada agora para estabilizar o schema. Nenhum evento é escrito
--    até o worker ser ativado na Fase 4 (o INSERT no RPC é adicionado
--    junto com o worker — não antes, para evitar acúmulo sem consumidor).
-- ============================================================

-- ── 1. crm_move_lead v2 ────────────────────────────────────────
--
-- Mudanças em relação à v1 (20260630_crm_pipelines_refactor.sql):
--   • SET search_path = public, pg_temp — evita shadow attack via
--     search_path manipulation pelo chamador autenticado.
--   • is_active = true no SELECT de crm_stages — impede mover lead
--     para etapa soft-deletada, mesmo que a exclusão ocorra
--     concorrentemente ao move.
--   • Removido RAISE EXCEPTION 'NOTE_REQUIRED' — validação de
--     require_note é responsabilidade do LeadService (camada de negócio),
--     não do RPC (camada de persistência atômica). Duplicar a regra aqui
--     cria dois pontos autoritativos para a mesma lógica.

CREATE OR REPLACE FUNCTION crm_move_lead(
  p_lead_id  uuid,
  p_user_id  uuid,
  p_stage_id uuid,
  p_note     text DEFAULT NULL,
  p_moved_by uuid DEFAULT NULL
)
RETURNS TABLE (
  lead_id       uuid,
  pipeline_id   uuid,
  stage_id      uuid,
  from_stage_id uuid,
  from_column   text,
  to_column     text
)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_from_stage_id uuid;
  v_from_column   text;
  v_pipeline_id   uuid;
  v_legacy_column text;
BEGIN
  SELECT l.stage_id, l.kanban_column
    INTO v_from_stage_id, v_from_column
  FROM leads l
  WHERE l.id = p_lead_id AND l.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEAD_NOT_FOUND';
  END IF;

  SELECT s.pipeline_id, s.legacy_column
    INTO v_pipeline_id, v_legacy_column
  FROM crm_stages s
  WHERE s.id      = p_stage_id
    AND s.user_id = p_user_id
    AND s.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STAGE_NOT_FOUND';
  END IF;

  UPDATE leads
  SET
    pipeline_id   = v_pipeline_id,
    stage_id      = p_stage_id,
    kanban_column = COALESCE(v_legacy_column, kanban_column),
    updated_at    = now()
  WHERE id = p_lead_id;

  INSERT INTO crm_lead_stage_history (
    lead_id, pipeline_id, stage_id, from_column, to_column, moved_by, note
  )
  VALUES (
    p_lead_id, v_pipeline_id, p_stage_id, v_from_column, v_legacy_column, p_moved_by, p_note
  );

  IF v_from_column IS NOT NULL
    AND v_legacy_column IS NOT NULL
    AND v_from_column <> v_legacy_column
  THEN
    INSERT INTO lead_movements (lead_id, from_column, to_column)
    VALUES (p_lead_id, v_from_column, v_legacy_column);
  END IF;

  -- Phase 4 activation point: add INSERT INTO domain_events_queue here,
  -- inside this same transaction, together with worker deployment.
  -- Do NOT add it before the worker is live — events would accumulate unprocessed.

  RETURN QUERY
  SELECT p_lead_id, v_pipeline_id, p_stage_id, v_from_stage_id, v_from_column, v_legacy_column;
END;
$$;

REVOKE ALL ON FUNCTION crm_move_lead(uuid, uuid, uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION crm_move_lead(uuid, uuid, uuid, text, uuid) TO authenticated;

-- ── 2. domain_events_queue ─────────────────────────────────────
--
-- Fila durável para processamento assíncrono de eventos de domínio.
-- Arquitetura Phase 4:
--
--   crm_move_lead (RPC, transação única)
--     └─ INSERT INTO domain_events_queue         ← ativado na Fase 4
--
--   Worker (cron ou Edge Function)
--     └─ SELECT ... FOR UPDATE SKIP LOCKED       ← processa sem corrida
--     └─ Despacha para ConversionEngine / Automations / Webhooks
--     └─ Retry com backoff exponencial via process_after
--     └─ Dead-letter após max_attempts
--
-- RLS habilitado sem políticas de acesso de usuário final —
-- apenas a service-role (admin client) lê e escreve esta tabela.

CREATE TABLE IF NOT EXISTS domain_events_queue (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type     text        NOT NULL,
  payload        jsonb       NOT NULL DEFAULT '{}',
  source         text        NOT NULL DEFAULT 'platform',
  correlation_id text,
  status         text        NOT NULL DEFAULT 'pending'
                             CHECK (status IN (
                               'pending', 'processing', 'completed', 'failed', 'dead_letter'
                             )),
  attempts       integer     NOT NULL DEFAULT 0,
  max_attempts   integer     NOT NULL DEFAULT 5,
  process_after  timestamptz NOT NULL DEFAULT now(),
  last_error     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  processed_at   timestamptz
);

-- Workers operam sob service-role e usam FOR UPDATE SKIP LOCKED.
-- RLS habilitado mas sem políticas abertas a usuários finais.
ALTER TABLE domain_events_queue ENABLE ROW LEVEL SECURITY;

-- Índice primário do worker: busca todos os eventos prontos para processar
-- em ordem de criação, sem tocar em linhas já em processamento.
CREATE INDEX IF NOT EXISTS domain_events_queue_worker_idx
  ON domain_events_queue (status, process_after)
  WHERE status IN ('pending', 'failed');

-- Índice de observabilidade: filtrar por tipo para dashboards e debug.
CREATE INDEX IF NOT EXISTS domain_events_queue_event_type_idx
  ON domain_events_queue (event_type, created_at DESC);
