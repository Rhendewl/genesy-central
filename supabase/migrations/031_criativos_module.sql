-- ─────────────────────────────────────────────────────────────────────────────
-- Lancaster SaaS — Migration 031: Módulo Gerador de Criativos IA
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Projetos de Criativos ──────────────────────────────────────────────────
-- Cada projeto representa uma campanha/briefing para geração de criativos.

CREATE TABLE IF NOT EXISTS criativo_projetos (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id       UUID        REFERENCES agency_clients(id) ON DELETE SET NULL,
  nome            TEXT        NOT NULL,
  objetivo        TEXT        NOT NULL,
  publico         TEXT        NOT NULL,
  oferta          TEXT        NOT NULL,
  tom             TEXT        NOT NULL DEFAULT 'profissional'
                                CHECK (tom IN ('urgente', 'sofisticado', 'amigavel', 'profissional', 'emocional', 'direto')),
  estilo_visual   TEXT        NOT NULL DEFAULT 'moderno'
                                CHECK (estilo_visual IN ('minimalista', 'bold', 'luxury', 'moderno', 'colorido', 'escuro')),
  segmento        TEXT        NOT NULL DEFAULT 'imobiliario'
                                CHECK (segmento IN ('imobiliario', 'varejo', 'servicos', 'saude', 'educacao', 'outro')),
  status          TEXT        NOT NULL DEFAULT 'rascunho'
                                CHECK (status IN ('rascunho', 'ativo', 'arquivado')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_criativo_projetos_user_id   ON criativo_projetos(user_id);
CREATE INDEX IF NOT EXISTS idx_criativo_projetos_client_id ON criativo_projetos(client_id);
CREATE INDEX IF NOT EXISTS idx_criativo_projetos_status    ON criativo_projetos(user_id, status);

CREATE TRIGGER update_criativo_projetos_updated_at
  BEFORE UPDATE ON criativo_projetos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 2. Assets do Projeto ──────────────────────────────────────────────────────
-- Logos, imagens e outros arquivos enviados pelo usuário para o projeto.

CREATE TABLE IF NOT EXISTS criativo_assets (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id      UUID        NOT NULL REFERENCES criativo_projetos(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo            TEXT        NOT NULL DEFAULT 'imagem'
                                CHECK (tipo IN ('logo', 'imagem', 'fundo', 'icone')),
  nome_arquivo    TEXT        NOT NULL,
  storage_path    TEXT        NOT NULL,
  url             TEXT        NOT NULL,
  tamanho_bytes   INTEGER,
  largura_px      INTEGER,
  altura_px       INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_criativo_assets_projeto_id ON criativo_assets(projeto_id);
CREATE INDEX IF NOT EXISTS idx_criativo_assets_user_id    ON criativo_assets(user_id);

-- ── 3. Jobs de Geração ────────────────────────────────────────────────────────
-- Máquina de estados para o pipeline de IA assíncrono.

CREATE TABLE IF NOT EXISTS criativo_jobs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id      UUID        NOT NULL REFERENCES criativo_projetos(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status          TEXT        NOT NULL DEFAULT 'pendente'
                                CHECK (status IN ('pendente', 'processando', 'concluido', 'erro')),
  quantidade      INTEGER     NOT NULL DEFAULT 5 CHECK (quantidade BETWEEN 1 AND 20),
  progresso       INTEGER     NOT NULL DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100),
  tokens_usados   INTEGER     NOT NULL DEFAULT 0,
  erro_mensagem   TEXT,
  iniciado_em     TIMESTAMPTZ,
  concluido_em    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_criativo_jobs_projeto_id ON criativo_jobs(projeto_id);
CREATE INDEX IF NOT EXISTS idx_criativo_jobs_user_id    ON criativo_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_criativo_jobs_status     ON criativo_jobs(user_id, status);

-- ── 4. Resultados Gerados ─────────────────────────────────────────────────────
-- Cada criativo gerado pelo pipeline de IA.

CREATE TABLE IF NOT EXISTS criativo_resultados (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID        NOT NULL REFERENCES criativo_jobs(id) ON DELETE CASCADE,
  projeto_id      UUID        NOT NULL REFERENCES criativo_projetos(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  variacao        INTEGER     NOT NULL,
  headline        TEXT,
  copy            TEXT,
  cta             TEXT,
  prompt_imagem   TEXT,
  imagem_url      TEXT,
  storage_path    TEXT,
  formato         TEXT        NOT NULL DEFAULT '1080x1080'
                                CHECK (formato IN ('1080x1080', '1080x1920', '1920x1080', '1200x628')),
  estilo_aplicado TEXT,
  favorito        BOOLEAN     NOT NULL DEFAULT FALSE,
  avaliacao       INTEGER     CHECK (avaliacao BETWEEN 1 AND 5),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_criativo_resultados_job_id      ON criativo_resultados(job_id);
CREATE INDEX IF NOT EXISTS idx_criativo_resultados_projeto_id  ON criativo_resultados(projeto_id);
CREATE INDEX IF NOT EXISTS idx_criativo_resultados_user_id     ON criativo_resultados(user_id);
CREATE INDEX IF NOT EXISTS idx_criativo_resultados_favorito    ON criativo_resultados(user_id, favorito);

CREATE TRIGGER update_criativo_resultados_updated_at
  BEFORE UPDATE ON criativo_resultados
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 5. Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE criativo_projetos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE criativo_assets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE criativo_jobs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE criativo_resultados ENABLE ROW LEVEL SECURITY;

-- criativo_projetos
DROP POLICY IF EXISTS "users_own_criativo_projetos" ON criativo_projetos;
CREATE POLICY "users_own_criativo_projetos"
  ON criativo_projetos FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- criativo_assets
DROP POLICY IF EXISTS "users_own_criativo_assets" ON criativo_assets;
CREATE POLICY "users_own_criativo_assets"
  ON criativo_assets FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- criativo_jobs
DROP POLICY IF EXISTS "users_own_criativo_jobs" ON criativo_jobs;
CREATE POLICY "users_own_criativo_jobs"
  ON criativo_jobs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- criativo_resultados
DROP POLICY IF EXISTS "users_own_criativo_resultados" ON criativo_resultados;
CREATE POLICY "users_own_criativo_resultados"
  ON criativo_resultados FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 6. Realtime (para progresso em tempo real do job) ─────────────────────────
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE criativo_jobs;       EXCEPTION WHEN SQLSTATE '42710' THEN NULL; WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE criativo_resultados; EXCEPTION WHEN SQLSTATE '42710' THEN NULL; WHEN OTHERS THEN NULL; END $$;
