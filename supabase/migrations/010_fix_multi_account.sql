-- =============================================================================
-- Lancaster SaaS — Migration 010: Fix Multi-Conta Meta Ads (idempotente)
-- Aplica as migrations 008 + 009 que nunca foram executadas no banco.
-- SEGURO para rodar múltiplas vezes — todas as operações usam IF NOT EXISTS.
-- =============================================================================
-- Cole no Supabase → SQL Editor → New query → Run
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. campaign_metrics: link_clicks e unique_ctr
--    (Meta API: inline_link_clicks e unique_ctr — migration 008)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE campaign_metrics
  ADD COLUMN IF NOT EXISTS link_clicks INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unique_ctr  NUMERIC(8,4) NOT NULL DEFAULT 0;

COMMENT ON COLUMN campaign_metrics.link_clicks IS
  'inline_link_clicks da Meta API — cliques apenas em links do anúncio (exclui curtidas, comentários, compartilhamentos). Mais preciso que o total de clicks.';

COMMENT ON COLUMN campaign_metrics.unique_ctr IS
  'CTR Único da Meta API — unique inline link clicks / reach × 100. Corresponde ao "CTR Único" do Gerenciador de Anúncios da Meta.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. campaigns: platform_account_id → FK para ad_platform_accounts
--    (suporte multi-conta — migration 009)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS platform_account_id UUID
    REFERENCES ad_platform_accounts(id) ON DELETE SET NULL;

COMMENT ON COLUMN campaigns.platform_account_id IS
  'Conta de anúncio (ad_platform_accounts) que originou/sincronizou esta campanha via Meta Ads. NULL = criada manualmente ou conta desconhecida.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. campaign_metrics: platform_account_id → FK para ad_platform_accounts
--    (desnormalizado para filtro rápido por conta — migration 009)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE campaign_metrics
  ADD COLUMN IF NOT EXISTS platform_account_id UUID
    REFERENCES ad_platform_accounts(id) ON DELETE SET NULL;

COMMENT ON COLUMN campaign_metrics.platform_account_id IS
  'Conta de anúncio origem destas métricas (desnormalizado para filtro rápido sem JOIN). Preenchido automaticamente no sync.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Índices para as novas colunas
-- ─────────────────────────────────────────────────────────────────────────────

-- Índice parcial: apenas linhas com link_clicks > 0 (queries de performance)
CREATE INDEX IF NOT EXISTS idx_cm_link_clicks
  ON campaign_metrics(campaign_id, date)
  WHERE link_clicks > 0;

-- Índice para filtrar campanhas por conta de anúncio
CREATE INDEX IF NOT EXISTS idx_campaigns_platform_account_id
  ON campaigns(platform_account_id);

-- Índice para filtrar métricas por conta de anúncio (dashboard/performance)
CREATE INDEX IF NOT EXISTS idx_cm_platform_account_id
  ON campaign_metrics(platform_account_id);

-- Índice composto para queries frequentes: (user + conta + data)
CREATE INDEX IF NOT EXISTS idx_cm_user_account_date
  ON campaign_metrics(user_id, platform_account_id, date);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Backfill best-effort: associar dados históricos à conta Meta conectada
--    Para usuários com apenas uma conta Meta → associa todas as campanhas.
--    Para usuários com múltiplas contas → só backfilla se ainda NULL.
--    Usuários com múltiplas contas precisarão re-sincronizar para separação.
-- ─────────────────────────────────────────────────────────────────────────────

-- 5a. Campanha Meta sem platform_account_id → associa à conta mais antiga conectada
UPDATE campaigns c
SET    platform_account_id = (
  SELECT apa.id
  FROM   ad_platform_accounts apa
  WHERE  apa.user_id  = c.user_id
    AND  apa.platform = 'meta'
    AND  apa.status   IN ('connected', 'error')  -- inclui error para preservar histórico
  ORDER  BY apa.created_at ASC
  LIMIT  1
)
WHERE  c.platform            = 'meta'
  AND  c.platform_account_id IS NULL
  AND  c.external_id         IS NOT NULL;

-- 5b. Propaga platform_account_id da campanha → métricas (sem sobrescrever preenchidos)
UPDATE campaign_metrics cm
SET    platform_account_id = c.platform_account_id
FROM   campaigns c
WHERE  cm.campaign_id         = c.id
  AND  cm.platform_account_id IS NULL
  AND  c.platform_account_id  IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Verificação final — retorna contagem de colunas para confirmar aplicação
-- ─────────────────────────────────────────────────────────────────────────────

SELECT
  'campaigns'        AS tabela,
  COUNT(*)           AS colunas_novas
FROM information_schema.columns
WHERE table_name  = 'campaigns'
  AND column_name = 'platform_account_id'
  AND table_schema = 'public'

UNION ALL

SELECT
  'campaign_metrics (platform_account_id)' AS tabela,
  COUNT(*) AS colunas_novas
FROM information_schema.columns
WHERE table_name  = 'campaign_metrics'
  AND column_name = 'platform_account_id'
  AND table_schema = 'public'

UNION ALL

SELECT
  'campaign_metrics (link_clicks)' AS tabela,
  COUNT(*) AS colunas_novas
FROM information_schema.columns
WHERE table_name  = 'campaign_metrics'
  AND column_name = 'link_clicks'
  AND table_schema = 'public'

UNION ALL

SELECT
  'campaign_metrics (unique_ctr)' AS tabela,
  COUNT(*) AS colunas_novas
FROM information_schema.columns
WHERE table_name  = 'campaign_metrics'
  AND column_name = 'unique_ctr'
  AND table_schema = 'public';

-- Se todas as 4 linhas retornarem "1", a migration foi aplicada com sucesso.
