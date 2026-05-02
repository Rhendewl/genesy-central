-- ═══════════════════════════════════════════════════════════════════════════════
-- Lancaster SaaS — Migration 008: Permissões granulares e tokens de convite
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Coluna permissions em user_profiles
--    Array JSON com os módulos que o usuário pode acessar.
--    Módulos: dashboard | crm | clientes | financeiro | trafego | portais | configuracoes
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL
  DEFAULT '["dashboard","crm","clientes","financeiro","trafego","portais"]'::jsonb;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Coluna token em user_invites (UUID único por convite — usado no link do e-mail)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.user_invites
  ADD COLUMN IF NOT EXISTS token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_invites_token
  ON public.user_invites (token);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS: membros da equipe podem ler o próprio perfil (via auth_user_id)
--    Necessário para o hook useCurrentMember buscar permissões após o login.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "user_profiles_member_select_own" ON public.user_profiles;
CREATE POLICY "user_profiles_member_select_own"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = auth_user_id);
