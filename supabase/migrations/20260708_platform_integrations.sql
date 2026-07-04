-- ============================================================
-- Platform Integrations — Módulo Global (Fase 1/6)
--
-- Converte crm_conversion_sources em platform_integrations,
-- módulo global de usuário não vinculado a pipeline.
--
-- Totalmente idempotente: pode ser re-executado sem erro.
--
-- Operações:
--   1. Renomeia crm_conversion_sources → platform_integrations
--   2. pipeline_id: NOT NULL → nullable (integrações globais)
--   3. Recria índices únicos com semântica global/pipeline
--   4. Adiciona platform_integration_id em appointment_conversions
--   5. Adiciona platform_integration_id em crm_stage_conversions
--   6. Backfill: povoa FK a partir de settings->>'pixel_integration_id'
--   7. Compat view crm_conversion_sources (deploy zero-downtime)
--
-- Estratégia Expand-and-Contract:
--   a. Rodar esta migration (expande: nova tabela + compat view)
--   b. Deploy das Fases 2–5 (código usa platform_integrations)
--   c. Migration de cleanup (Fase 6: remove compat view)
-- ============================================================

-- ── 1. Rename (idempotente) ───────────────────────────────────────────────────

DO $$
BEGIN
  -- Renomeia somente se a tabela antiga existe (e a nova ainda não existe como tabela base)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'crm_conversion_sources'
      AND table_type   = 'BASE TABLE'
  ) THEN
    ALTER TABLE crm_conversion_sources RENAME TO platform_integrations;
  END IF;
END $$;

-- ── 2. Rename index (idempotente) ─────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname  = 'crm_conversion_sources_default_idx'
  ) THEN
    ALTER INDEX crm_conversion_sources_default_idx
      RENAME TO platform_integrations_default_idx;
  END IF;
END $$;

-- ── 3. pipeline_id nullable ───────────────────────────────────────────────────
-- DROP NOT NULL é no-op se a coluna já for nullable — seguro re-executar.

ALTER TABLE platform_integrations
  ALTER COLUMN pipeline_id DROP NOT NULL;

-- ── 4. Recria índices únicos com semântica global ─────────────────────────────
--
-- Índice antigo: UNIQUE (pipeline_id, provider) WHERE is_default = true
-- NULL != NULL em unique indexes → múltiplos padrões globais seriam permitidos.
-- Dois índices parciais resolvem cada semântica de forma independente.

DROP INDEX IF EXISTS platform_integrations_default_idx;

CREATE UNIQUE INDEX IF NOT EXISTS platform_integrations_pipeline_default_idx
  ON platform_integrations (pipeline_id, provider)
  WHERE is_default = true AND pipeline_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS platform_integrations_global_default_idx
  ON platform_integrations (user_id, provider)
  WHERE is_default = true AND pipeline_id IS NULL;

-- ── 5. FK em appointment_conversions ─────────────────────────────────────────

ALTER TABLE appointment_conversions
  ADD COLUMN IF NOT EXISTS platform_integration_id uuid
    REFERENCES platform_integrations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS appointment_conversions_platform_integration_id_idx
  ON appointment_conversions (platform_integration_id)
  WHERE platform_integration_id IS NOT NULL;

-- ── 6. FK em crm_stage_conversions ───────────────────────────────────────────

ALTER TABLE crm_stage_conversions
  ADD COLUMN IF NOT EXISTS platform_integration_id uuid
    REFERENCES platform_integrations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS crm_stage_conversions_platform_integration_id_idx
  ON crm_stage_conversions (platform_integration_id)
  WHERE platform_integration_id IS NOT NULL;

-- ── 7. Backfill ───────────────────────────────────────────────────────────────
--
-- Povoa platform_integration_id a partir de settings->>'pixel_integration_id'.
-- Regex valida UUID antes do cast; EXISTS garante integridade referencial.
-- Idempotente: WHERE platform_integration_id IS NULL evita sobrescrever.

UPDATE appointment_conversions ac
SET    platform_integration_id = (ac.settings->>'pixel_integration_id')::uuid
WHERE  ac.platform_integration_id IS NULL
  AND  (ac.settings->>'pixel_integration_id') ~
         '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND  EXISTS (
         SELECT 1
         FROM   platform_integrations pi
         WHERE  pi.id = (ac.settings->>'pixel_integration_id')::uuid
       );

UPDATE crm_stage_conversions sc
SET    platform_integration_id = (sc.settings->>'pixel_integration_id')::uuid
WHERE  sc.platform_integration_id IS NULL
  AND  (sc.settings->>'pixel_integration_id') ~
         '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND  EXISTS (
         SELECT 1
         FROM   platform_integrations pi
         WHERE  pi.id = (sc.settings->>'pixel_integration_id')::uuid
       );

-- ── 8. Compat view (zero-downtime) ────────────────────────────────────────────
--
-- Pods antigos em deploy continuam lendo de crm_conversion_sources por ~60s.
-- security_invoker = true: RLS da tabela subjacente se aplica ao caller.
-- Remover na migration de cleanup (20260709) após deploy confirmado.
--
-- A view só é criada se crm_conversion_sources não existe como tabela base
-- (ou seja, se o rename já aconteceu e não existe view ainda).

DO $$
BEGIN
  -- Cria a view apenas se não existir (como view — não como tabela base)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public'
      AND table_name   = 'crm_conversion_sources'
  ) THEN
    EXECUTE $sql$
      CREATE VIEW crm_conversion_sources
        WITH (security_invoker = true)
      AS
        SELECT * FROM platform_integrations
    $sql$;
  END IF;
END $$;

-- INSTEAD OF INSERT ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION _platform_integrations_compat_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  inserted platform_integrations;
BEGIN
  INSERT INTO platform_integrations (
    id,              user_id,         pipeline_id,     name,
    provider,        pixel_id,        access_token,    test_event_code,
    is_default,      is_active,       last_success_at, last_error,
    last_error_at,   created_by,      created_at,      updated_at
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()),
    NEW.user_id,         NEW.pipeline_id,     NEW.name,
    NEW.provider,        NEW.pixel_id,        NEW.access_token,    NEW.test_event_code,
    COALESCE(NEW.is_default, false),
    COALESCE(NEW.is_active,  true),
    NEW.last_success_at, NEW.last_error,
    NEW.last_error_at,   NEW.created_by,
    COALESCE(NEW.created_at, now()),
    COALESCE(NEW.updated_at, now())
  ) RETURNING * INTO inserted;

  NEW.id         := inserted.id;
  NEW.created_at := inserted.created_at;
  NEW.updated_at := inserted.updated_at;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER crm_conversion_sources_insert
  INSTEAD OF INSERT ON crm_conversion_sources
  FOR EACH ROW EXECUTE FUNCTION _platform_integrations_compat_insert();

-- INSTEAD OF UPDATE ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION _platform_integrations_compat_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE platform_integrations SET
    user_id         = NEW.user_id,
    pipeline_id     = NEW.pipeline_id,
    name            = NEW.name,
    provider        = NEW.provider,
    pixel_id        = NEW.pixel_id,
    access_token    = NEW.access_token,
    test_event_code = NEW.test_event_code,
    is_default      = NEW.is_default,
    is_active       = NEW.is_active,
    last_success_at = NEW.last_success_at,
    last_error      = NEW.last_error,
    last_error_at   = NEW.last_error_at,
    created_by      = NEW.created_by,
    updated_at      = NEW.updated_at
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER crm_conversion_sources_update
  INSTEAD OF UPDATE ON crm_conversion_sources
  FOR EACH ROW EXECUTE FUNCTION _platform_integrations_compat_update();

-- INSTEAD OF DELETE ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION _platform_integrations_compat_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM platform_integrations WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE TRIGGER crm_conversion_sources_delete
  INSTEAD OF DELETE ON crm_conversion_sources
  FOR EACH ROW EXECUTE FUNCTION _platform_integrations_compat_delete();
