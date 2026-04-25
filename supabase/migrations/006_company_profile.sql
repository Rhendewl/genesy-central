-- ─────────────────────────────────────────────────────────────────────────────
-- Lancaster SaaS — Migration 006: Perfil da Empresa
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS company_profile (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identidade
  company_name TEXT,
  trade_name   TEXT,
  logo_url     TEXT,
  website      TEXT,
  description  TEXT,

  -- Dados empresariais
  cnpj         TEXT,
  email        TEXT,
  phone        TEXT,
  whatsapp     TEXT,
  address      TEXT,
  city         TEXT,
  state        TEXT,
  zip_code     TEXT,
  country      TEXT NOT NULL DEFAULT 'Brasil',

  -- Preferências operacionais
  timezone     TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  currency     TEXT NOT NULL DEFAULT 'BRL',
  language     TEXT NOT NULL DEFAULT 'pt-BR',
  date_format  TEXT NOT NULL DEFAULT 'DD/MM/YYYY',

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cada usuário possui exatamente um perfil
CREATE UNIQUE INDEX IF NOT EXISTS company_profile_user_id_key
  ON company_profile (user_id);

-- updated_at automático
CREATE OR REPLACE FUNCTION update_company_profile_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_profile_updated_at ON company_profile;
CREATE TRIGGER trg_company_profile_updated_at
  BEFORE UPDATE ON company_profile
  FOR EACH ROW EXECUTE FUNCTION update_company_profile_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE company_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_profile_select_own" ON company_profile;
CREATE POLICY "company_profile_select_own" ON company_profile
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "company_profile_insert_own" ON company_profile;
CREATE POLICY "company_profile_insert_own" ON company_profile
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "company_profile_update_own" ON company_profile;
CREATE POLICY "company_profile_update_own" ON company_profile
  FOR UPDATE USING (auth.uid() = user_id);

-- ── Storage bucket (criar manualmente no Supabase Dashboard) ─────────────────
-- Bucket: "company-logos"  |  Public: true  |  Max size: 5 MB
-- Allowed MIME: image/jpeg, image/png, image/webp, image/svg+xml
