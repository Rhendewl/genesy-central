-- Estado do alerta de saldo por conta de anúncio.
-- A tabela permite avisar somente quando o saldo cruza o limite para baixo e
-- rearmar o alerta depois que uma recarga leva o saldo de volta ao normal.

CREATE TABLE IF NOT EXISTS public.portal_balance_alert_states (
  portal_id           uuid        NOT NULL REFERENCES public.portals(id) ON DELETE CASCADE,
  ad_account_id       text        NOT NULL,
  last_balance        numeric     NOT NULL DEFAULT 0,
  is_below_threshold  boolean     NOT NULL DEFAULT false,
  alert_sequence      integer     NOT NULL DEFAULT 0,
  last_alerted_at     timestamptz,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (portal_id, ad_account_id)
);

CREATE INDEX IF NOT EXISTS portal_balance_alert_states_low_idx
  ON public.portal_balance_alert_states (portal_id, is_below_threshold)
  WHERE is_below_threshold = true;

ALTER TABLE public.portal_balance_alert_states ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.portal_balance_alert_states IS
  'Memória de transição dos alertas de saldo baixo das contas exibidas em portais.';
