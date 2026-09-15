-- VGV Intelligence: public sale collection, private commission rules and campaign economics.

ALTER TABLE public.marketing_vgv_sales
  ADD COLUMN IF NOT EXISTS agency_client_id uuid REFERENCES public.agency_clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS buyer_name text,
  ADD COLUMN IF NOT EXISTS campaign_name text,
  ADD COLUMN IF NOT EXISTS development_name text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS form_id uuid,
  ADD COLUMN IF NOT EXISTS include_agency_commission boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS agency_share_percentage numeric(5,2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS custom_answers jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.marketing_vgv_sales
SET buyer_name = client_name
WHERE buyer_name IS NULL;

DO $$ BEGIN
  ALTER TABLE public.marketing_vgv_sales ADD CONSTRAINT marketing_vgv_sales_source_chk
    CHECK (source IN ('manual', 'form'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.marketing_vgv_sales ADD CONSTRAINT marketing_vgv_sales_agency_share_chk
    CHECK (agency_share_percentage BETWEEN 0 AND 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS marketing_vgv_sales_client_campaign_idx
  ON public.marketing_vgv_sales (organization_id, agency_client_id, campaign_name, sale_date DESC);

CREATE TABLE IF NOT EXISTS public.marketing_vgv_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_client_id uuid NOT NULL REFERENCES public.agency_clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  default_commission_percentage numeric(5,2) NOT NULL DEFAULT 0 CHECK (default_commission_percentage BETWEEN 0 AND 100),
  include_agency_commission boolean NOT NULL DEFAULT false,
  agency_share_percentage numeric(5,2) NOT NULL DEFAULT 0 CHECK (agency_share_percentage BETWEEN 0 AND 100),
  custom_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_vgv_sales
  DROP CONSTRAINT IF EXISTS marketing_vgv_sales_form_id_fkey;
ALTER TABLE public.marketing_vgv_sales
  ADD CONSTRAINT marketing_vgv_sales_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.marketing_vgv_forms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS marketing_vgv_forms_org_client_idx
  ON public.marketing_vgv_forms (organization_id, agency_client_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.marketing_vgv_campaign_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_client_id uuid NOT NULL REFERENCES public.agency_clients(id) ON DELETE CASCADE,
  campaign_name text NOT NULL,
  development_name text,
  period_start date NOT NULL,
  period_end date NOT NULL,
  spend numeric(14,2) NOT NULL DEFAULT 0 CHECK (spend >= 0),
  leads integer NOT NULL DEFAULT 0 CHECK (leads >= 0),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS marketing_vgv_campaign_performance_range_idx
  ON public.marketing_vgv_campaign_performance (organization_id, agency_client_id, period_start, period_end);

ALTER TABLE public.marketing_vgv_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_vgv_campaign_performance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_vgv_forms_all ON public.marketing_vgv_forms;
CREATE POLICY marketing_vgv_forms_all ON public.marketing_vgv_forms FOR ALL
  USING (organization_id = public.effective_owner_id())
  WITH CHECK (organization_id = public.effective_owner_id());

DROP POLICY IF EXISTS marketing_vgv_campaign_performance_all ON public.marketing_vgv_campaign_performance;
CREATE POLICY marketing_vgv_campaign_performance_all ON public.marketing_vgv_campaign_performance FOR ALL
  USING (organization_id = public.effective_owner_id())
  WITH CHECK (organization_id = public.effective_owner_id());

SELECT public.ensure_updated_at_trigger('marketing_vgv_forms');
SELECT public.ensure_updated_at_trigger('marketing_vgv_campaign_performance');
