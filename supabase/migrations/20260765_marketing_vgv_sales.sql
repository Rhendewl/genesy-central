-- Marketing — VGV manual por organização.

CREATE TABLE IF NOT EXISTS public.marketing_vgv_sales (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sale_value              numeric(14,2) NOT NULL CHECK (sale_value > 0),
  broker_name             text NOT NULL CHECK (char_length(btrim(broker_name)) BETWEEN 1 AND 160),
  client_name             text NOT NULL CHECK (char_length(btrim(client_name)) BETWEEN 1 AND 160),
  commission_percentage   numeric(5,2) NOT NULL CHECK (commission_percentage BETWEEN 0 AND 100),
  sale_date               date NOT NULL DEFAULT current_date,
  created_by              uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_vgv_sales_org_date_idx
  ON public.marketing_vgv_sales (organization_id, sale_date DESC);

ALTER TABLE public.marketing_vgv_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_vgv_sales_select ON public.marketing_vgv_sales;
DROP POLICY IF EXISTS marketing_vgv_sales_insert ON public.marketing_vgv_sales;
DROP POLICY IF EXISTS marketing_vgv_sales_update ON public.marketing_vgv_sales;
DROP POLICY IF EXISTS marketing_vgv_sales_delete ON public.marketing_vgv_sales;

CREATE POLICY marketing_vgv_sales_select ON public.marketing_vgv_sales
  FOR SELECT USING (organization_id = public.effective_owner_id());

CREATE POLICY marketing_vgv_sales_insert ON public.marketing_vgv_sales
  FOR INSERT WITH CHECK (
    organization_id = public.effective_owner_id()
    AND created_by = auth.uid()
  );

CREATE POLICY marketing_vgv_sales_update ON public.marketing_vgv_sales
  FOR UPDATE USING (
    organization_id = public.effective_owner_id()
    AND (created_by = auth.uid() OR auth.uid() = organization_id OR public.is_admin_of_user(organization_id))
  )
  WITH CHECK (organization_id = public.effective_owner_id());

CREATE POLICY marketing_vgv_sales_delete ON public.marketing_vgv_sales
  FOR DELETE USING (
    organization_id = public.effective_owner_id()
    AND (created_by = auth.uid() OR auth.uid() = organization_id OR public.is_admin_of_user(organization_id))
  );

SELECT public.ensure_updated_at_trigger('marketing_vgv_sales');

COMMENT ON TABLE public.marketing_vgv_sales IS
  'Registros manuais de vendas atribuídas ao trabalho de Marketing para cálculo do VGV.';
