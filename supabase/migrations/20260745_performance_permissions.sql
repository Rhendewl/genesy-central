-- ═══════════════════════════════════════════════════════════════════════════════
-- Performance — libera módulo para administradores existentes
--
-- ROLE_DEFAULT_PERMISSIONS afeta novos convites/perfis. Perfis já existentes
-- guardam permissions em JSONB, então precisam receber a nova chave uma vez.
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE public.user_profiles
SET permissions = permissions || '["performance"]'::jsonb
WHERE role = 'admin'
  AND NOT (permissions ? 'performance');
