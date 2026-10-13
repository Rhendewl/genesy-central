-- Contas de anúncios por corretor e controle do último envio manual.

ALTER TABLE public.commercial_brokers
  ADD COLUMN IF NOT EXISTS meta_account_ids uuid[] NOT NULL DEFAULT '{}';

UPDATE public.commercial_brokers broker
SET meta_account_ids = settings.meta_account_ids
FROM public.commercial_intelligence_settings settings
WHERE settings.client_id = broker.client_id
  AND cardinality(broker.meta_account_ids) = 0
  AND cardinality(settings.meta_account_ids) > 0;

ALTER TABLE public.commercial_intelligence_settings
  ADD COLUMN IF NOT EXISTS last_manual_send_at timestamptz;

ALTER TABLE public.commercial_collection_deliveries
  ADD COLUMN IF NOT EXISTS delivery_type text NOT NULL DEFAULT 'automatic';

ALTER TABLE public.commercial_collection_deliveries
  DROP CONSTRAINT IF EXISTS commercial_collection_deliveries_delivery_type_check;

ALTER TABLE public.commercial_collection_deliveries
  ADD CONSTRAINT commercial_collection_deliveries_delivery_type_check
  CHECK (delivery_type IN ('automatic', 'manual'));

COMMENT ON COLUMN public.commercial_brokers.meta_account_ids IS
  'Contas Meta cujas campanhas devem aparecer no formulário deste corretor.';
COMMENT ON COLUMN public.commercial_intelligence_settings.last_manual_send_at IS
  'Último disparo manual, usado para impedir repetição automática no mesmo ciclo.';
COMMENT ON COLUMN public.commercial_collection_deliveries.delivery_type IS
  'Origem do disparo: automático ou manual.';
