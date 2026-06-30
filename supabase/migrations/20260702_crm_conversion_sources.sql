-- ============================================================
-- Phase 3: CRM Conversion Sources (Origens)
--
-- Armazena configurações de integração de conversão vinculadas
-- às pipelines do CRM. Cada origem representa um pixel/provider
-- configurado para uma pipeline específica.
--
-- Design decisions:
--   • provider text NOT NULL — espelha ConversionPlatform; permite
--     múltiplos providers (Meta, Google, TikTok) por pipeline.
--   • access_token text NOT NULL — armazenado em texto nesta fase.
--     O isolamento está na camada de API (GET mascara o token).
--     Migração futura para Secret Provider altera apenas as rotas.
--   • Índice partial UNIQUE em (pipeline_id, provider) WHERE
--     is_default = true — garante no máximo um default por provider
--     por pipeline, permitindo múltiplas origens e múltiplos providers.
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_conversion_sources (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  pipeline_id      uuid        NOT NULL REFERENCES crm_pipelines(id)  ON DELETE CASCADE,
  name             text        NOT NULL,
  description      text,
  provider         text        NOT NULL DEFAULT 'meta_pixel',
  pixel_id         text        NOT NULL,
  access_token     text        NOT NULL,
  test_event_code  text,
  is_default       boolean     NOT NULL DEFAULT false,
  is_active        boolean     NOT NULL DEFAULT true,
  last_success_at  timestamptz,
  last_error       text,
  last_error_at    timestamptz,
  created_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ── RLS ────────────────────────────────────────────────────────────────────────

ALTER TABLE crm_conversion_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_conversion_sources_owner" ON crm_conversion_sources;
CREATE POLICY "crm_conversion_sources_owner"
  ON crm_conversion_sources
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Indexes ────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS crm_conversion_sources_user_idx
  ON crm_conversion_sources (user_id);

CREATE INDEX IF NOT EXISTS crm_conversion_sources_pipeline_idx
  ON crm_conversion_sources (pipeline_id);

-- At most one default source per (pipeline, provider).
-- Allows: multiple Meta pixels per pipeline (only one default).
-- Allows: independent defaults per provider (Meta default ≠ Google default).
CREATE UNIQUE INDEX IF NOT EXISTS crm_conversion_sources_default_idx
  ON crm_conversion_sources (pipeline_id, provider)
  WHERE is_default = true;

-- ── updated_at trigger ─────────────────────────────────────────────────────────

SELECT public.ensure_updated_at_trigger('crm_conversion_sources');
