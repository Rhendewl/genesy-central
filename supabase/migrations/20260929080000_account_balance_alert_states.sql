-- Estado dos alertas de saldo para todas as contas Meta conectadas, inclusive
-- as que ainda não estão vinculadas a um portal de cliente.

CREATE TABLE IF NOT EXISTS public.account_balance_alert_states (
  owner_user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ad_account_id      text        NOT NULL,
  last_balance       numeric     NOT NULL DEFAULT 0,
  is_below_threshold boolean     NOT NULL DEFAULT false,
  alert_sequence     integer     NOT NULL DEFAULT 0,
  last_alerted_at    timestamptz,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_user_id, ad_account_id)
);

CREATE INDEX IF NOT EXISTS account_balance_alert_states_low_idx
  ON public.account_balance_alert_states (owner_user_id, is_below_threshold)
  WHERE is_below_threshold = true;

ALTER TABLE public.account_balance_alert_states ENABLE ROW LEVEL SECURITY;

-- Preserva a memória dos alertas já enviados pelo fluxo antigo de portais.
INSERT INTO public.account_balance_alert_states (
  owner_user_id,
  ad_account_id,
  last_balance,
  is_below_threshold,
  alert_sequence,
  last_alerted_at,
  updated_at
)
SELECT DISTINCT ON (p.user_id, s.ad_account_id)
  p.user_id,
  s.ad_account_id,
  s.last_balance,
  s.is_below_threshold,
  s.alert_sequence,
  s.last_alerted_at,
  s.updated_at
FROM public.portal_balance_alert_states s
JOIN public.portals p ON p.id = s.portal_id
ORDER BY p.user_id, s.ad_account_id, s.updated_at DESC
ON CONFLICT (owner_user_id, ad_account_id) DO NOTHING;

COMMENT ON TABLE public.account_balance_alert_states IS
  'Memória de transição dos alertas de saldo de todas as contas Meta conectadas.';
