-- =============================================================================
-- Lancaster SaaS — Módulo Formulários Conversacionais
-- Idempotente: pode ser executado várias vezes sem erro
-- Executar no Supabase → SQL Editor → New query → Run
-- =============================================================================
-- NOTA: workspace_id adaptado para user_id (padrão da plataforma).
-- A função update_updated_at() já existe no banco — não é recriada aqui.
-- =============================================================================

-- ── 1. Forms ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS forms (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  name           TEXT        NOT NULL,
  slug           TEXT        NOT NULL,
  description    TEXT,
  status         TEXT        NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft', 'published', 'archived', 'disabled')),
  theme          JSONB       NOT NULL DEFAULT '{}',
  settings       JSONB       NOT NULL DEFAULT '{}',
  steps          JSONB       NOT NULL DEFAULT '[]',
  logic_rules    JSONB       NOT NULL DEFAULT '[]',
  welcome_screen JSONB       NOT NULL DEFAULT '{"enabled":true,"title":"","description":"","buttonText":"Começar"}',
  endings        JSONB       NOT NULL DEFAULT '[]',
  integrations   JSONB       NOT NULL DEFAULT '{}',
  published_at   TIMESTAMPTZ,
  deleted_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Slug único por usuário (apenas registros não deletados)
CREATE UNIQUE INDEX IF NOT EXISTS forms_user_slug_idx     ON forms(user_id, slug) WHERE deleted_at IS NULL;
CREATE INDEX        IF NOT EXISTS forms_user_id_idx       ON forms(user_id);
CREATE INDEX        IF NOT EXISTS forms_slug_idx          ON forms(slug);
CREATE INDEX        IF NOT EXISTS forms_status_idx        ON forms(user_id, status);
CREATE INDEX        IF NOT EXISTS forms_created_at_idx    ON forms(created_at DESC);
CREATE INDEX        IF NOT EXISTS forms_published_at_idx  ON forms(published_at DESC) WHERE published_at IS NOT NULL;

DROP TRIGGER IF EXISTS forms_updated_at ON forms;
CREATE TRIGGER forms_updated_at
  BEFORE UPDATE ON forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 2. Sessions ───────────────────────────────────────────────────────────────
-- Representa um visitante que iniciou o formulário.
-- user_id = dono do formulário (herdado do form), não o visitante.

CREATE TABLE IF NOT EXISTS form_sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id       UUID        NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token         TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  device        TEXT,
  browser       TEXT,
  os            TEXT,
  language      TEXT,
  country       TEXT,
  ip            TEXT,
  utm_source    TEXT,
  utm_medium    TEXT,
  utm_campaign  TEXT,
  utm_term      TEXT,
  utm_content   TEXT,
  fbclid        TEXT,
  gclid         TEXT,
  referrer      TEXT,
  is_partial    BOOLEAN     NOT NULL DEFAULT TRUE,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at   TIMESTAMPTZ,
  abandoned_at  TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS form_sessions_token_idx      ON form_sessions(token);
CREATE INDEX        IF NOT EXISTS form_sessions_form_id_idx    ON form_sessions(form_id);
CREATE INDEX        IF NOT EXISTS form_sessions_user_id_idx    ON form_sessions(user_id);
CREATE INDEX        IF NOT EXISTS form_sessions_started_at_idx ON form_sessions(started_at DESC);

-- ── 3. Submissions ────────────────────────────────────────────────────────────
-- Respostas de uma sessão. Nunca remover — apenas arquivar via status.

CREATE TABLE IF NOT EXISTS form_submissions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id       UUID        NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id    UUID        REFERENCES form_sessions(id) ON DELETE SET NULL,
  lead_id       UUID        REFERENCES leads(id) ON DELETE SET NULL,
  status        TEXT        NOT NULL DEFAULT 'completed'
                              CHECK (status IN ('partial', 'completed', 'spam')),
  answers       JSONB       NOT NULL DEFAULT '{}',
  score         INTEGER,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS form_submissions_form_id_idx    ON form_submissions(form_id);
CREATE INDEX IF NOT EXISTS form_submissions_user_id_idx    ON form_submissions(user_id);
CREATE INDEX IF NOT EXISTS form_submissions_session_id_idx ON form_submissions(session_id);
CREATE INDEX IF NOT EXISTS form_submissions_created_at_idx ON form_submissions(created_at DESC);

-- ── 4. Events ─────────────────────────────────────────────────────────────────
-- Todos os eventos de analytics. step_id é TEXT (referência ao JSON, não FK).

CREATE TABLE IF NOT EXISTS form_events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id       UUID        NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id    UUID        REFERENCES form_sessions(id) ON DELETE SET NULL,
  step_id       TEXT,
  event         TEXT        NOT NULL
                              CHECK (event IN (
                                'page_loaded', 'session_started', 'welcome_view',
                                'step_view', 'step_completed', 'validation_error',
                                'logic_executed', 'submission_started', 'submission_finished',
                                'booking_started', 'booking_finished', 'abandoned',
                                'restart', 'back_clicked'
                              )),
  duration      INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS form_events_form_id_idx    ON form_events(form_id);
CREATE INDEX IF NOT EXISTS form_events_session_id_idx ON form_events(session_id);
CREATE INDEX IF NOT EXISTS form_events_event_idx      ON form_events(user_id, event);
CREATE INDEX IF NOT EXISTS form_events_created_at_idx ON form_events(created_at DESC);

-- ── 5. Versions ───────────────────────────────────────────────────────────────
-- Snapshot imutável gerado a cada publicação. Nunca sobrescrever versões antigas.

CREATE TABLE IF NOT EXISTS form_versions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id       UUID        NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version       INTEGER     NOT NULL,
  snapshot      JSONB       NOT NULL,
  published_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (form_id, version)
);

CREATE INDEX IF NOT EXISTS form_versions_form_id_idx ON form_versions(form_id);
CREATE INDEX IF NOT EXISTS form_versions_user_id_idx ON form_versions(user_id);

-- ── 6. Templates ──────────────────────────────────────────────────────────────
-- Gerenciado pelo sistema. Sem user_id — leitura pública para usuários autenticados.

CREATE TABLE IF NOT EXISTS form_templates (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT        NOT NULL,
  description    TEXT,
  category       TEXT        NOT NULL DEFAULT 'outro'
                               CHECK (category IN ('rh', 'imobiliario', 'comercial', 'clinicas', 'pesquisa', 'eventos', 'outro')),
  thumbnail_url  TEXT,
  steps          JSONB       NOT NULL DEFAULT '[]',
  welcome_screen JSONB       NOT NULL DEFAULT '{}',
  endings        JSONB       NOT NULL DEFAULT '[]',
  settings       JSONB       NOT NULL DEFAULT '{}',
  is_public      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS form_templates_category_idx ON form_templates(category);

-- ── 7. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE forms            ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_versions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_templates   ENABLE ROW LEVEL SECURITY;

-- forms: dono gerencia tudo; visitante lê formulários publicados pelo slug
DROP POLICY IF EXISTS "forms_select_owner"   ON forms;
DROP POLICY IF EXISTS "forms_select_public"  ON forms;
DROP POLICY IF EXISTS "forms_insert_owner"   ON forms;
DROP POLICY IF EXISTS "forms_update_owner"   ON forms;
DROP POLICY IF EXISTS "forms_delete_owner"   ON forms;

CREATE POLICY "forms_select_owner"  ON forms FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "forms_select_public" ON forms FOR SELECT
  USING (status = 'published' AND deleted_at IS NULL);
CREATE POLICY "forms_insert_owner"  ON forms FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "forms_update_owner"  ON forms FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "forms_delete_owner"  ON forms FOR DELETE USING (auth.uid() = user_id);

-- form_sessions: dono lê; visitante (anônimo) insere e atualiza via token
DROP POLICY IF EXISTS "form_sessions_select_owner"    ON form_sessions;
DROP POLICY IF EXISTS "form_sessions_insert_public"   ON form_sessions;
DROP POLICY IF EXISTS "form_sessions_update_public"   ON form_sessions;

CREATE POLICY "form_sessions_select_owner"  ON form_sessions FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "form_sessions_insert_public" ON form_sessions FOR INSERT
  WITH CHECK (true);
CREATE POLICY "form_sessions_update_public" ON form_sessions FOR UPDATE
  USING (true);

-- form_submissions: dono lê; visitante insere
DROP POLICY IF EXISTS "form_submissions_select_owner"  ON form_submissions;
DROP POLICY IF EXISTS "form_submissions_insert_public" ON form_submissions;

CREATE POLICY "form_submissions_select_owner"  ON form_submissions FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "form_submissions_insert_public" ON form_submissions FOR INSERT
  WITH CHECK (true);

-- form_events: dono lê; visitante insere
DROP POLICY IF EXISTS "form_events_select_owner"  ON form_events;
DROP POLICY IF EXISTS "form_events_insert_public" ON form_events;

CREATE POLICY "form_events_select_owner"  ON form_events FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "form_events_insert_public" ON form_events FOR INSERT
  WITH CHECK (true);

-- form_versions: apenas dono
DROP POLICY IF EXISTS "form_versions_owner" ON form_versions;
CREATE POLICY "form_versions_owner" ON form_versions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- form_templates: leitura pública (sistema gerencia via service role)
DROP POLICY IF EXISTS "form_templates_select_all" ON form_templates;
CREATE POLICY "form_templates_select_all" ON form_templates FOR SELECT USING (true);

-- ── 8. Realtime ───────────────────────────────────────────────────────────────
-- Habilitar para o editor ver submissões em tempo real

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE form_submissions; EXCEPTION WHEN SQLSTATE '42710' THEN NULL; WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE form_sessions;    EXCEPTION WHEN SQLSTATE '42710' THEN NULL; WHEN OTHERS THEN NULL; END $$;
