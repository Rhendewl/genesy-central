-- Fixed business value applied to each new lead captured from this Meta form.
ALTER TABLE public.meta_form_subscriptions
  ADD COLUMN IF NOT EXISTS crm_deal_value numeric(14,2) NOT NULL DEFAULT 0
  CHECK (crm_deal_value >= 0);
