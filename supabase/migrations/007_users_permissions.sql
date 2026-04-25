-- ═══════════════════════════════════════════════════════════════════════════════
-- Lancaster SaaS — Migration 007: Usuários e Permissões
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tabela user_profiles
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  auth_user_id UUID,                            -- preenchido quando o convidado aceita
  full_name    TEXT        NOT NULL,
  email        TEXT        NOT NULL,
  role         TEXT        NOT NULL DEFAULT 'viewer'
                           CHECK (role IN ('admin','comercial','trafego','financeiro','operacional','viewer')),
  job_title    TEXT,
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  avatar_url   TEXT,
  last_seen_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT user_profiles_owner_email_key UNIQUE (owner_id, email)
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_owner_id  ON public.user_profiles (owner_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role      ON public.user_profiles (role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_active ON public.user_profiles (is_active);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Tabela user_invites
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_invites (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT        NOT NULL,
  role         TEXT        NOT NULL DEFAULT 'viewer'
                           CHECK (role IN ('admin','comercial','trafego','financeiro','operacional','viewer')),
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','accepted','revoked')),
  invited_by   UUID        NOT NULL REFERENCES auth.users(id),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_invites_owner_id ON public.user_invites (owner_id);
CREATE INDEX IF NOT EXISTS idx_user_invites_status   ON public.user_invites (status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Trigger updated_at
-- ─────────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invites  ENABLE ROW LEVEL SECURITY;

-- user_profiles ---------------------------------------------------------------

DROP POLICY IF EXISTS "user_profiles_select_own" ON public.user_profiles;
CREATE POLICY "user_profiles_select_own"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "user_profiles_insert_own" ON public.user_profiles;
CREATE POLICY "user_profiles_insert_own"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "user_profiles_update_own" ON public.user_profiles;
CREATE POLICY "user_profiles_update_own"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "user_profiles_delete_own" ON public.user_profiles;
CREATE POLICY "user_profiles_delete_own"
  ON public.user_profiles FOR DELETE
  USING (auth.uid() = owner_id);

-- user_invites ----------------------------------------------------------------

DROP POLICY IF EXISTS "user_invites_select_own" ON public.user_invites;
CREATE POLICY "user_invites_select_own"
  ON public.user_invites FOR SELECT
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "user_invites_insert_own" ON public.user_invites;
CREATE POLICY "user_invites_insert_own"
  ON public.user_invites FOR INSERT
  WITH CHECK (auth.uid() = owner_id AND auth.uid() = invited_by);

DROP POLICY IF EXISTS "user_invites_update_own" ON public.user_invites;
CREATE POLICY "user_invites_update_own"
  ON public.user_invites FOR UPDATE
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "user_invites_delete_own" ON public.user_invites;
CREATE POLICY "user_invites_delete_own"
  ON public.user_invites FOR DELETE
  USING (auth.uid() = owner_id);
