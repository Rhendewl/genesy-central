-- Configurable CRM lead origins shared by manual leads, forms and Instagram.
-- `leads.source` remains populated for backwards compatibility with reports,
-- conversion integrations and existing exports.

CREATE TABLE IF NOT EXISTS public.crm_lead_origins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 60),
  slug text NOT NULL CHECK (char_length(trim(slug)) BETWEEN 1 AND 80),
  color text NOT NULL DEFAULT '#64748b',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, slug)
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_lead_origins_one_default_idx
  ON public.crm_lead_origins (user_id) WHERE is_default = true;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS origin_id uuid REFERENCES public.crm_lead_origins(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS leads_origin_id_idx ON public.leads (origin_id);

ALTER TABLE public.marketing_instagram_automations
  ADD COLUMN IF NOT EXISTS crm_origin_id uuid REFERENCES public.crm_lead_origins(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS crm_assigned_to uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS crm_deal_value numeric(14,2) NOT NULL DEFAULT 0 CHECK (crm_deal_value >= 0);

-- Seed useful options for every workspace already using CRM, forms or Instagram.
WITH owners AS (
  SELECT DISTINCT user_id FROM public.leads
  UNION SELECT DISTINCT user_id FROM public.forms
  UNION SELECT DISTINCT user_id FROM public.crm_pipelines
  UNION SELECT DISTINCT organization_id AS user_id FROM public.marketing_instagram_connections
), defaults(slug, name, color, is_default) AS (
  VALUES
    ('manual', 'Manual', '#64748b', true),
    ('formulario_genesy', 'Formulário', '#2563eb', false),
    ('instagram_automation', 'Instagram', '#db2777', false),
    ('meta_lead_ads', 'Meta Lead Ads', '#1877f2', false),
    ('youtube', 'YouTube', '#ef4444', false),
    ('whatsapp', 'WhatsApp', '#22c55e', false),
    ('site', 'Site', '#0ea5e9', false),
    ('indicacao', 'Indicação', '#8b5cf6', false),
    ('email_marketing', 'E-mail marketing', '#f59e0b', false),
    ('evento', 'Evento', '#14b8a6', false)
)
INSERT INTO public.crm_lead_origins (user_id, slug, name, color, is_default)
SELECT owners.user_id, defaults.slug, defaults.name, defaults.color, defaults.is_default
FROM owners CROSS JOIN defaults
WHERE owners.user_id IS NOT NULL
ON CONFLICT (user_id, slug) DO NOTHING;

-- Preserve custom/legacy source values as selectable origins too.
INSERT INTO public.crm_lead_origins (user_id, slug, name, color)
SELECT DISTINCT
  lead.user_id,
  left(trim(lead.source), 80),
  left(initcap(replace(trim(lead.source), '_', ' ')), 60),
  '#64748b'
FROM public.leads lead
WHERE nullif(trim(lead.source), '') IS NOT NULL
ON CONFLICT (user_id, slug) DO NOTHING;

UPDATE public.leads lead
SET origin_id = origin.id
FROM public.crm_lead_origins origin
WHERE lead.origin_id IS NULL
  AND origin.user_id = lead.user_id
  AND origin.slug = lead.source;

CREATE OR REPLACE FUNCTION public.sync_lead_origin_source()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE origin_slug text;
BEGIN
  IF NEW.origin_id IS NULL THEN RETURN NEW; END IF;
  SELECT slug INTO origin_slug FROM public.crm_lead_origins
  WHERE id = NEW.origin_id AND user_id = NEW.user_id;
  IF origin_slug IS NULL THEN
    RAISE EXCEPTION 'Origem não pertence ao workspace do lead';
  END IF;
  NEW.source := origin_slug;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS leads_sync_origin_source ON public.leads;
CREATE TRIGGER leads_sync_origin_source
  BEFORE INSERT OR UPDATE OF origin_id, user_id, source ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.sync_lead_origin_source();

DROP TRIGGER IF EXISTS trg_auto_owner_crm_lead_origins ON public.crm_lead_origins;
CREATE TRIGGER trg_auto_owner_crm_lead_origins
  BEFORE INSERT ON public.crm_lead_origins
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_owner_id();

SELECT public.apply_standard_rls('crm_lead_origins');
SELECT public.ensure_updated_at_trigger('crm_lead_origins');

COMMENT ON TABLE public.crm_lead_origins IS
  'Workspace-configurable lead origins. The slug is mirrored in leads.source for backwards compatibility.';
