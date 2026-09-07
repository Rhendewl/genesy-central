-- Link fixo por imobiliária para a Análise Comercial.
-- Idempotente e seguro para bancos que já receberam a migration de 04/09.

ALTER TABLE public.commercial_intelligence_settings
  ADD COLUMN IF NOT EXISTS public_slug text;

UPDATE public.commercial_intelligence_settings settings
SET public_slug = trim(both '-' from regexp_replace(
    translate(lower(client.name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
    '[^a-z0-9]+', '-', 'g'
  )) || '-' || left(settings.client_id::text, 6)
FROM public.agency_clients client
WHERE client.id = settings.client_id
  AND settings.public_slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS commercial_intelligence_public_slug_idx
  ON public.commercial_intelligence_settings(public_slug)
  WHERE public_slug IS NOT NULL;

COMMENT ON COLUMN public.commercial_intelligence_settings.public_slug IS
  'Identificador permanente da imobiliária na rota /analise-comercial/[slug].';
