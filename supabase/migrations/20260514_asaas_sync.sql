-- Add asaas_payment_id to revenues for Asaas sync deduplication
ALTER TABLE revenues
  ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_revenues_asaas_payment_id
  ON revenues(asaas_payment_id)
  WHERE asaas_payment_id IS NOT NULL;
