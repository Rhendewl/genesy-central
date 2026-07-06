-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: Corrige drift do CHECK de role + expande taxonomia de papéis
--
-- Bug encontrado em auditoria: 20260426_complete_schema.sql adicionou um
-- segundo CHECK constraint nomeado (user_profiles_role_chk / user_invites_role_chk)
-- com um conjunto mais estreito ('admin','editor','viewer'), que passou a
-- coexistir com o CHECK original de 007_users_permissions.sql ('admin',
-- 'comercial','trafego','financeiro','operacional','viewer'). Como os dois
-- constraints valem ao mesmo tempo (AND), hoje só 'admin' e 'viewer' passam
-- nos dois simultaneamente — qualquer outro papel está efetivamente bloqueado
-- no banco, mesmo a UI (src/lib/roles.ts) permitindo selecioná-lo.
--
-- Fix: remove os dois CHECKs (nome autogerado da migration 007 + nome
-- estreito de 20260426) e recria um único CHECK com o conjunto completo,
-- mais os dois papéis novos pedidos (designer, gestor_comercial).
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_chk;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_chk
  CHECK (role IN ('admin','comercial','trafego','financeiro','operacional','viewer','designer','gestor_comercial'));

ALTER TABLE public.user_invites DROP CONSTRAINT IF EXISTS user_invites_role_check;
ALTER TABLE public.user_invites DROP CONSTRAINT IF EXISTS user_invites_role_chk;
ALTER TABLE public.user_invites ADD CONSTRAINT user_invites_role_chk
  CHECK (role IN ('admin','comercial','trafego','financeiro','operacional','viewer','designer','gestor_comercial'));
