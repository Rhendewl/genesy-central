-- Registra quando um corretor informa que não participou de um empreendimento
-- da coleta. Esses pares deixam de compor as respostas esperadas do dashboard.

CREATE TABLE IF NOT EXISTS public.commercial_collection_skips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES public.commercial_collections(id) ON DELETE CASCADE,
  broker_id uuid NOT NULL REFERENCES public.commercial_brokers(id) ON DELETE CASCADE,
  development_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, broker_id, development_name)
);

CREATE INDEX IF NOT EXISTS commercial_collection_skips_collection_idx
  ON public.commercial_collection_skips(collection_id, broker_id);

ALTER TABLE public.commercial_collection_skips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_collection_skips_owner_all
  ON public.commercial_collection_skips;
CREATE POLICY commercial_collection_skips_owner_all
  ON public.commercial_collection_skips
  FOR ALL
  USING (public.effective_owner_id() = user_id)
  WITH CHECK (public.effective_owner_id() = user_id);

DROP TRIGGER IF EXISTS trg_auto_owner_commercial_collection_skips
  ON public.commercial_collection_skips;
CREATE TRIGGER trg_auto_owner_commercial_collection_skips
  BEFORE INSERT ON public.commercial_collection_skips
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_owner_id();

COMMENT ON TABLE public.commercial_collection_skips IS
  'Empreendimentos que um corretor declarou não ter atendido em uma coleta comercial.';
