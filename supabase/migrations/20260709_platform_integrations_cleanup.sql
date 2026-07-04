-- ============================================================
-- Platform Integrations — Cleanup (Fase 6/6)
--
-- Remove estruturas temporárias criadas para zero-downtime deploy:
--   - Compat view crm_conversion_sources
--   - Funções INSTEAD OF auxiliares
--
-- Pré-requisito: deploy das Fases 2–5 concluído e verificado.
-- Todo o código agora usa platform_integrations diretamente.
--
-- NÃO faz ainda:
--   - Remover pixel_integration_id do jsonb (Phase 6b, pós validação prod)
--   - Alterar UI para usar platform_integration_id como fonte primária
-- ============================================================

BEGIN;

DROP VIEW IF EXISTS crm_conversion_sources CASCADE;

DROP FUNCTION IF EXISTS _platform_integrations_compat_insert();
DROP FUNCTION IF EXISTS _platform_integrations_compat_update();
DROP FUNCTION IF EXISTS _platform_integrations_compat_delete();

COMMIT;
