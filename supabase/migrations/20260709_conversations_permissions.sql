-- ═══════════════════════════════════════════════════════════════════════════════
-- Conversas — libera módulo para perfis existentes
--
-- ROLE_DEFAULT_PERMISSIONS afeta novos convites/perfis. Perfis já existentes
-- guardam permissions em JSONB, então precisam receber a nova chave uma vez.
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE public.user_profiles
SET permissions = permissions || '["conversas"]'::jsonb
WHERE role IN ('admin', 'comercial', 'operacional', 'gestor_comercial')
  AND NOT (permissions ? 'conversas');
