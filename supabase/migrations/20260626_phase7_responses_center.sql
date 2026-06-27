-- =============================================================================
-- Lancaster SaaS — Phase 7: Central de Respostas
-- =============================================================================
--
-- CONTEXTO
--   • Augmenta form_submissions com colunas necessárias para a Central.
--   • Corrige bug do 20260626_integrations.sql: REFERENCES formularios(id)
--     (tabela inexistente). Cria form_integrations e integration_deliveries
--     com FK correto para forms(id).
--   • Cria form_saved_views para persistência de views configuradas.
--
-- IDEMPOTÊNCIA
--   • CREATE TABLE IF NOT EXISTS
--   • CREATE INDEX IF NOT EXISTS
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS
--   • DROP CONSTRAINT/TRIGGER/POLICY IF EXISTS antes de recriar
--   • CREATE OR REPLACE FUNCTION
--   • DO blocks para operações condicionais
--
-- COMPATIBILIDADE
--   • PostgreSQL 17 / Supabase
--   • Sem extensões extras além das já habilitadas (uuid-ossp está presente)
--
-- EXECUTAR
--   Supabase → SQL Editor → New query → Run
-- =============================================================================

BEGIN;

-- =============================================================================
-- BLOCO 0 — Funções auxiliares (canônicas, idempotentes)
-- =============================================================================

-- ── 0.1 Trigger function para updated_at ─────────────────────────────────────
-- Redefine com CREATE OR REPLACE para garantir existência independente de
-- qual migration rodou antes.

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ── 0.2 Função de busca full-text sobre JSONB de respostas ───────────────────
-- Extrai apenas os valores (não as chaves) de um objeto JSONB plano.
-- jsonb_each_text é nativa do PostgreSQL — sem dependências extras.
-- IMMUTABLE + PARALLEL SAFE: pode ser usada em índices e parallel queries.

CREATE OR REPLACE FUNCTION answers_to_tsvector(j JSONB)
RETURNS TSVECTOR LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT COALESCE(
    to_tsvector(
      'portuguese',
      (
        SELECT string_agg(kv.value, ' ')
        FROM   jsonb_each_text(j) AS kv(key, value)
        WHERE  kv.value IS NOT NULL
          AND  kv.value <> ''
          AND  length(kv.value) < 5000
      )
    ),
    to_tsvector('portuguese', '')
  )
$$;

-- ── 0.3 Trigger function para manter answers_tsv sincronizado ────────────────

CREATE OR REPLACE FUNCTION trg_form_submissions_fts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.answers_tsv := answers_to_tsvector(NEW.answers);
  RETURN NEW;
END;
$$;

-- =============================================================================
-- BLOCO 1 — Augmentar form_submissions
-- =============================================================================
-- Tabela criada em 20260625_forms_module.sql.
-- Adicionamos colunas necessárias para a Central de Respostas sem remover nada.

-- ── 1.1 Colunas novas ────────────────────────────────────────────────────────

ALTER TABLE form_submissions
  ADD COLUMN IF NOT EXISTS correlation_id   TEXT,
  ADD COLUMN IF NOT EXISTS step_timings     JSONB        NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS drop_off_step    TEXT,
  ADD COLUMN IF NOT EXISTS time_on_form_ms  INTEGER,
  ADD COLUMN IF NOT EXISTS read_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS starred          BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archived         BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS answers_tsv      TSVECTOR;

-- ── 1.2 Status CHECK — expandir para incluir 'started' e 'abandoned' ─────────
-- Nome padrão gerado pelo PostgreSQL para constraint inline: {table}_{col}_check
-- Usamos DROP IF EXISTS + ADD para ser idempotente.

ALTER TABLE form_submissions
  DROP CONSTRAINT IF EXISTS form_submissions_status_check;

ALTER TABLE form_submissions
  ADD CONSTRAINT form_submissions_status_check
  CHECK (status IN ('partial', 'started', 'completed', 'spam', 'abandoned'));

-- ── 1.3 Trigger — updated_at ─────────────────────────────────────────────────

DROP TRIGGER IF EXISTS form_submissions_updated_at ON form_submissions;
CREATE TRIGGER form_submissions_updated_at
  BEFORE UPDATE ON form_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 1.4 Trigger — answers_tsv ────────────────────────────────────────────────

DROP TRIGGER IF EXISTS form_submissions_fts ON form_submissions;
CREATE TRIGGER form_submissions_fts
  BEFORE INSERT OR UPDATE OF answers ON form_submissions
  FOR EACH ROW EXECUTE FUNCTION trg_form_submissions_fts();

-- ── 1.5 Backfill answers_tsv para linhas existentes ──────────────────────────
-- Executado uma única vez; em execuções subsequentes WHERE answers_tsv IS NULL
-- não retorna linhas e o UPDATE é uma no-op eficiente.

UPDATE form_submissions
SET    answers_tsv = answers_to_tsvector(answers)
WHERE  answers_tsv IS NULL;

-- ── 1.6 Índices ───────────────────────────────────────────────────────────────

-- Cursor pagination (criado_at DESC, id DESC)
CREATE INDEX IF NOT EXISTS form_submissions_cursor_idx
  ON form_submissions(created_at DESC, id DESC);

-- Busca por correlationId (join com event-bus e integration_deliveries)
CREATE INDEX IF NOT EXISTS form_submissions_correlation_id_idx
  ON form_submissions(correlation_id)
  WHERE correlation_id IS NOT NULL;

-- Filtro por starred
CREATE INDEX IF NOT EXISTS form_submissions_starred_idx
  ON form_submissions(form_id, starred)
  WHERE starred = TRUE;

-- Filtro por archived
CREATE INDEX IF NOT EXISTS form_submissions_archived_idx
  ON form_submissions(form_id, archived);

-- Filtro por não-lido (read_at IS NULL = "novo")
CREATE INDEX IF NOT EXISTS form_submissions_unread_idx
  ON form_submissions(form_id, created_at DESC)
  WHERE read_at IS NULL;

-- Filtro por drop_off_step (análise de abandono por etapa)
CREATE INDEX IF NOT EXISTS form_submissions_drop_off_idx
  ON form_submissions(form_id, drop_off_step)
  WHERE drop_off_step IS NOT NULL;

-- GIN sobre answers (filtragem por valor de resposta específica)
CREATE INDEX IF NOT EXISTS form_submissions_answers_gin_idx
  ON form_submissions USING GIN(answers);

-- GIN sobre answers_tsv (full-text search)
CREATE INDEX IF NOT EXISTS form_submissions_fts_idx
  ON form_submissions USING GIN(answers_tsv);

-- =============================================================================
-- BLOCO 2 — RLS de form_submissions (expandir políticas existentes)
-- =============================================================================
-- A migration 20260625 criou SELECT (owner) e INSERT (public).
-- Adicionamos: UPDATE owner, UPDATE public (para sessão atualizar status),
-- service_role bypass, e política de read_at/starred separadas.

ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;

-- Remover e recriar todas as políticas para garantir consistência
DROP POLICY IF EXISTS "form_submissions_select_owner"    ON form_submissions;
DROP POLICY IF EXISTS "form_submissions_insert_public"   ON form_submissions;
DROP POLICY IF EXISTS "form_submissions_update_owner"    ON form_submissions;
DROP POLICY IF EXISTS "form_submissions_update_public"   ON form_submissions;
DROP POLICY IF EXISTS "form_submissions_delete_owner"    ON form_submissions;
DROP POLICY IF EXISTS "form_submissions_service_role"    ON form_submissions;

-- service_role: acesso total (usado pelas API routes autenticadas)
CREATE POLICY "form_submissions_service_role"
  ON form_submissions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Dono do formulário: lê todas as suas submissões
CREATE POLICY "form_submissions_select_owner"
  ON form_submissions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Visitante anônimo/autenticado: insere nova submissão
CREATE POLICY "form_submissions_insert_public"
  ON form_submissions FOR INSERT
  WITH CHECK (true);

-- Visitante: atualiza a própria submissão via session_id (progresso da sessão)
-- Não exige autenticação — usa session_id como token de posse.
CREATE POLICY "form_submissions_update_public"
  ON form_submissions FOR UPDATE
  USING (true);

-- Dono do formulário: arquiva, estrala, marca como lido
CREATE POLICY "form_submissions_update_owner"
  ON form_submissions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Dono do formulário: pode excluir (soft delete recomendado; política disponível)
CREATE POLICY "form_submissions_delete_owner"
  ON form_submissions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- =============================================================================
-- BLOCO 3 — Augmentar form_sessions (índice para lookup por token/correlationId)
-- =============================================================================
-- form_sessions.token é o correlationId do event-bus.
-- O índice único já existe (form_sessions_token_idx criado em 20260625).
-- Adicionamos apenas o que está faltando.

-- Garantir RLS habilitada (já estava, mas não custa)
ALTER TABLE form_sessions ENABLE ROW LEVEL SECURITY;

-- Adicionar UPDATE policy para o dono — permitir marcar sessão como finalizada
DROP POLICY IF EXISTS "form_sessions_update_owner"  ON form_sessions;
CREATE POLICY "form_sessions_update_owner"
  ON form_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- service_role: acesso total
DROP POLICY IF EXISTS "form_sessions_service_role"  ON form_sessions;
CREATE POLICY "form_sessions_service_role"
  ON form_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- BLOCO 4 — form_integrations
-- =============================================================================
-- Substitui o 20260626_integrations.sql que tinha REFERENCES formularios(id)
-- (tabela inexistente). Cria com FK correto para forms(id).
-- Se a tabela já existir (de uma execução anterior correta), IF NOT EXISTS garante
-- que este bloco é uma no-op segura.

CREATE TABLE IF NOT EXISTS form_integrations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id      UUID        NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  adapter      TEXT        NOT NULL
               CHECK (adapter IN ('meta-pixel', 'ga4', 'webhook', 'crm')),
  enabled      BOOLEAN     NOT NULL DEFAULT TRUE,
  settings     JSONB       NOT NULL DEFAULT '{}',
  secrets      JSONB       NOT NULL DEFAULT '{}',
  event_filter TEXT[],
  retry_policy JSONB,
  rate_limit   JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Adicionar user_id caso a tabela já existia sem ele
ALTER TABLE form_integrations
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Apenas um registro por adapter por formulário
CREATE UNIQUE INDEX IF NOT EXISTS form_integrations_form_adapter_idx
  ON form_integrations(form_id, adapter);

-- Lookup por formulário (integrations ativas)
DROP INDEX IF EXISTS form_integrations_form_id_idx;
CREATE INDEX IF NOT EXISTS form_integrations_form_id_idx
  ON form_integrations(form_id)
  WHERE enabled = TRUE;

-- Lookup por usuário (listagem do dashboard)
CREATE INDEX IF NOT EXISTS form_integrations_user_id_idx
  ON form_integrations(user_id);

-- ── Trigger updated_at ───────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS form_integrations_updated_at ON form_integrations;
CREATE TRIGGER form_integrations_updated_at
  BEFORE UPDATE ON form_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE form_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "form_integrations_service_role"  ON form_integrations;
DROP POLICY IF EXISTS "form_integrations_select_owner"  ON form_integrations;
DROP POLICY IF EXISTS "form_integrations_insert_owner"  ON form_integrations;
DROP POLICY IF EXISTS "form_integrations_update_owner"  ON form_integrations;
DROP POLICY IF EXISTS "form_integrations_delete_owner"  ON form_integrations;

-- service_role: acesso total
CREATE POLICY "form_integrations_service_role"
  ON form_integrations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Dono: acesso total via user_id direto (sem subquery — mais eficiente)
-- Para linhas antigas sem user_id, o fallback usa o form.user_id
CREATE POLICY "form_integrations_select_owner"
  ON form_integrations FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM forms
      WHERE forms.id = form_integrations.form_id
        AND forms.user_id = auth.uid()
    )
  );

CREATE POLICY "form_integrations_insert_owner"
  ON form_integrations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM forms
      WHERE forms.id = form_integrations.form_id
        AND forms.user_id = auth.uid()
    )
  );

CREATE POLICY "form_integrations_update_owner"
  ON form_integrations FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM forms
      WHERE forms.id = form_integrations.form_id
        AND forms.user_id = auth.uid()
    )
  );

CREATE POLICY "form_integrations_delete_owner"
  ON form_integrations FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM forms
      WHERE forms.id = form_integrations.form_id
        AND forms.user_id = auth.uid()
    )
  );

-- =============================================================================
-- BLOCO 5 — integration_deliveries
-- =============================================================================
-- Registro imutável de cada tentativa de entrega de uma integração.
-- Inclui form_id e adapter_name denormalizados para queries da Central de
-- Respostas sem JOINs adicionais.

CREATE TABLE IF NOT EXISTS integration_deliveries (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID        REFERENCES form_integrations(id) ON DELETE SET NULL,
  form_id        UUID        NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  adapter_name   TEXT        NOT NULL,
  event_id       TEXT        NOT NULL,
  correlation_id TEXT        NOT NULL,
  event_type     TEXT        NOT NULL,
  attempt        INTEGER     NOT NULL DEFAULT 1,
  ok             BOOLEAN     NOT NULL,
  status_code    INTEGER,
  duration_ms    INTEGER,
  error          TEXT,
  payload        JSONB,
  delivered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Adicionar colunas denormalizadas caso a tabela já exista sem elas
ALTER TABLE integration_deliveries
  ADD COLUMN IF NOT EXISTS form_id      UUID REFERENCES forms(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS adapter_name TEXT,
  ADD COLUMN IF NOT EXISTS payload      JSONB;

-- Lookup por correlationId — chave principal de join com form_submissions
CREATE INDEX IF NOT EXISTS integration_deliveries_correlation_idx
  ON integration_deliveries(correlation_id);

-- Lookup por form_id + delivered_at (aba Integrações da Central)
CREATE INDEX IF NOT EXISTS integration_deliveries_form_id_idx
  ON integration_deliveries(form_id, delivered_at DESC);

-- Lookup por event_id (deduplicação / idempotência)
CREATE INDEX IF NOT EXISTS integration_deliveries_event_id_idx
  ON integration_deliveries(event_id, integration_id);

-- Lookup cronológico global
CREATE INDEX IF NOT EXISTS integration_deliveries_delivered_at_idx
  ON integration_deliveries(delivered_at DESC);

-- Lookup por adapter (filtrar por integração específica)
CREATE INDEX IF NOT EXISTS integration_deliveries_adapter_idx
  ON integration_deliveries(form_id, adapter_name, delivered_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE integration_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "integration_deliveries_service_role"  ON integration_deliveries;
DROP POLICY IF EXISTS "integration_deliveries_select_owner"  ON integration_deliveries;
DROP POLICY IF EXISTS "integration_deliveries_insert_any"    ON integration_deliveries;

-- service_role: acesso total (escrita feita pela infraestrutura de integração)
CREATE POLICY "integration_deliveries_service_role"
  ON integration_deliveries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Usuário autenticado lê deliveries dos próprios formulários
CREATE POLICY "integration_deliveries_select_owner"
  ON integration_deliveries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM forms
      WHERE forms.id = integration_deliveries.form_id
        AND forms.user_id = auth.uid()
    )
  );

-- Inserção irrestrita: a infraestrutura de integração opera sem autenticação
-- do usuário final (usa service_role key no servidor)
CREATE POLICY "integration_deliveries_insert_any"
  ON integration_deliveries FOR INSERT
  WITH CHECK (true);

-- =============================================================================
-- BLOCO 6 — form_saved_views
-- =============================================================================
-- Vistas configuradas pelo usuário na Central de Respostas.
-- Cada vista persiste: filtros, ordenação, colunas, agrupamento.
-- form_id NULL = vista global (todos os formulários).

CREATE TABLE IF NOT EXISTS form_saved_views (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  form_id     UUID        REFERENCES forms(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  icon        TEXT,
  color       TEXT,
  config      JSONB       NOT NULL DEFAULT '{}',
  is_default  BOOLEAN     NOT NULL DEFAULT FALSE,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Apenas uma vista default por usuário por formulário
CREATE UNIQUE INDEX IF NOT EXISTS form_saved_views_default_idx
  ON form_saved_views(user_id, form_id)
  WHERE is_default = TRUE AND form_id IS NOT NULL;

-- Apenas uma vista default global por usuário
CREATE UNIQUE INDEX IF NOT EXISTS form_saved_views_default_global_idx
  ON form_saved_views(user_id)
  WHERE is_default = TRUE AND form_id IS NULL;

CREATE INDEX IF NOT EXISTS form_saved_views_user_id_idx
  ON form_saved_views(user_id, sort_order ASC);

CREATE INDEX IF NOT EXISTS form_saved_views_form_id_idx
  ON form_saved_views(user_id, form_id)
  WHERE form_id IS NOT NULL;

-- ── Trigger updated_at ───────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS form_saved_views_updated_at ON form_saved_views;
CREATE TRIGGER form_saved_views_updated_at
  BEFORE UPDATE ON form_saved_views
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE form_saved_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "form_saved_views_service_role"  ON form_saved_views;
DROP POLICY IF EXISTS "form_saved_views_owner"         ON form_saved_views;

CREATE POLICY "form_saved_views_service_role"
  ON form_saved_views
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "form_saved_views_owner"
  ON form_saved_views
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- BLOCO 7 — Realtime
-- =============================================================================
-- form_submissions e form_sessions já foram adicionadas em 20260625.
-- Adicionamos integration_deliveries para atualização em tempo real no drawer.
-- DO block captura o erro "already a member" — idempotente.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE integration_deliveries;
EXCEPTION
  WHEN SQLSTATE '42710' THEN NULL;  -- duplicate_object (já na publicação)
  WHEN OTHERS            THEN NULL;  -- publication não existe em alguns envs
END $$;

-- =============================================================================
-- BLOCO 8 — Índices complementares em form_events
-- =============================================================================
-- form_events é a tabela de timeline. Adicionamos índices para as queries
-- da aba Timeline da Central de Respostas (por session_id e event_type).
-- Os índices básicos já existem em 20260625; estes são complementares.

-- Lookup de todos os eventos de uma sessão em ordem cronológica
CREATE INDEX IF NOT EXISTS form_events_session_seq_idx
  ON form_events(session_id, created_at ASC)
  WHERE session_id IS NOT NULL;

-- Filtro de eventos de lógica (Logic Engine tab)
CREATE INDEX IF NOT EXISTS form_events_logic_idx
  ON form_events(session_id, event)
  WHERE event IN ('rule_matched', 'rule_not_matched', 'jump_executed',
                  'logic_executed', 'ending_reached', 'redirect_executed');

-- =============================================================================
-- BLOCO 9 — Comentários de documentação nas tabelas
-- =============================================================================

COMMENT ON TABLE form_submissions IS
  'Respostas de formulários. Uma linha por sessão concluída ou em andamento. '
  'Fonte principal da Central de Respostas (Phase 7).';

COMMENT ON COLUMN form_submissions.correlation_id IS
  'ID de correlação do event-bus. Corresponde a form_sessions.token. '
  'Usado para JOIN com integration_deliveries e form_events.';

COMMENT ON COLUMN form_submissions.step_timings IS
  'Mapa stepId → tempo gasto em ms. Ex: {"step_abc": 4200, "step_def": 1800}.';

COMMENT ON COLUMN form_submissions.answers_tsv IS
  'Vetor de busca full-text gerado automaticamente pelo trigger form_submissions_fts. '
  'Contém apenas os VALORES das respostas (não as chaves JSON).';

COMMENT ON COLUMN form_submissions.read_at IS
  'NULL = resposta nova (não lida). Preenchido quando o usuário abre a resposta.';

COMMENT ON TABLE form_integrations IS
  'Configurações de integração por formulário. '
  'Substitui a versão com FK incorreta do 20260626_integrations.sql.';

COMMENT ON TABLE integration_deliveries IS
  'Log imutável de cada tentativa de entrega de integração. '
  'form_id e adapter_name denormalizados para queries da Central sem JOINs.';

COMMENT ON TABLE form_saved_views IS
  'Vistas salvas da Central de Respostas. '
  'config JSONB contém: filters, sort[], columns[], groupBy.';

-- =============================================================================
-- FIM
-- =============================================================================

COMMIT;
