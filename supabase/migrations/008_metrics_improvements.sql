-- ─────────────────────────────────────────────────────────────────────────────
-- Lancaster SaaS — Migration 008: Melhorias nas métricas de campanha
-- Adiciona colunas para armazenar métricas da Meta Ads com maior fidelidade:
--   link_clicks  → inline_link_clicks (cliques em links, mais preciso que total)
--   unique_ctr   → CTR único da Meta (unique_inline_link_clicks / reach * 100)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE campaign_metrics
  ADD COLUMN IF NOT EXISTS link_clicks  INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unique_ctr   NUMERIC(8,4)  NOT NULL DEFAULT 0;

-- Índice para queries que filtram por link_clicks (relatórios de performance)
CREATE INDEX IF NOT EXISTS idx_cm_link_clicks ON campaign_metrics(campaign_id, date) WHERE link_clicks > 0;

COMMENT ON COLUMN campaign_metrics.link_clicks IS
  'inline_link_clicks da Meta API — cliques apenas em links do anúncio (excluindo curtidas, comentários, etc.)';

COMMENT ON COLUMN campaign_metrics.unique_ctr IS
  'unique_ctr da Meta API — CTR único (unique inline link clicks / reach * 100). Corresponde ao "CTR Único" exibido no Gerenciador de Anúncios da Meta.';
