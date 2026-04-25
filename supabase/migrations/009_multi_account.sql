-- ─────────────────────────────────────────────────────────────────────────────
-- Lancaster SaaS — Migration 009: Suporte multi-conta Meta Ads
-- Adiciona platform_account_id a campaigns e campaign_metrics para permitir
-- filtrar dados por conta de anúncio individual.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── campaigns ─────────────────────────────────────────────────────────────────

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS platform_account_id UUID
    REFERENCES ad_platform_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_platform_account_id
  ON campaigns(platform_account_id);

COMMENT ON COLUMN campaigns.platform_account_id IS
  'Conta de anúncio (ad_platform_accounts) que originou/sincronizou esta campanha.';

-- ── campaign_metrics ──────────────────────────────────────────────────────────

ALTER TABLE campaign_metrics
  ADD COLUMN IF NOT EXISTS platform_account_id UUID
    REFERENCES ad_platform_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cm_platform_account_id
  ON campaign_metrics(platform_account_id);

COMMENT ON COLUMN campaign_metrics.platform_account_id IS
  'Conta de anúncio origem destas métricas (desnormalizado para filtro rápido).';

-- ── Backfill best-effort para dados existentes ────────────────────────────────
-- Para usuários com apenas uma conta Meta conectada, associa todas as campanhas
-- Meta existentes a ela.  Usuários com múltiplas contas precisarão re-sincronizar.

UPDATE campaigns c
SET platform_account_id = (
  SELECT apa.id
  FROM   ad_platform_accounts apa
  WHERE  apa.user_id   = c.user_id
    AND  apa.platform  = 'meta'
    AND  apa.status    = 'connected'
  ORDER  BY apa.created_at
  LIMIT  1
)
WHERE c.platform             = 'meta'
  AND c.platform_account_id  IS NULL
  AND c.external_id          IS NOT NULL;

-- Propaga para campaign_metrics via JOIN com campaigns

UPDATE campaign_metrics cm
SET    platform_account_id = c.platform_account_id
FROM   campaigns c
WHERE  cm.campaign_id          = c.id
  AND  cm.platform_account_id  IS NULL
  AND  c.platform_account_id   IS NOT NULL;
