-- Daily account-level Instagram insights. Unlike media metrics, these values
-- represent the account audience for the period and must not be derived by
-- summing reach from individual posts.
CREATE TABLE IF NOT EXISTS public.marketing_instagram_account_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  connection_id uuid NOT NULL REFERENCES public.marketing_instagram_connections(id) ON DELETE CASCADE,
  insight_date date NOT NULL,
  followers_count bigint NOT NULL DEFAULT 0,
  reach bigint NOT NULL DEFAULT 0,
  views bigint NOT NULL DEFAULT 0,
  profile_views bigint NOT NULL DEFAULT 0,
  accounts_engaged bigint NOT NULL DEFAULT 0,
  total_interactions bigint NOT NULL DEFAULT 0,
  likes bigint NOT NULL DEFAULT 0,
  comments bigint NOT NULL DEFAULT 0,
  shares bigint NOT NULL DEFAULT 0,
  saves bigint NOT NULL DEFAULT 0,
  profile_links_taps bigint NOT NULL DEFAULT 0,
  raw_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, insight_date)
);

CREATE INDEX IF NOT EXISTS marketing_instagram_account_insights_org_date_idx
  ON public.marketing_instagram_account_insights (organization_id, insight_date DESC);
ALTER TABLE public.marketing_instagram_account_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_instagram_account_insights_select ON public.marketing_instagram_account_insights;
CREATE POLICY marketing_instagram_account_insights_select ON public.marketing_instagram_account_insights
  FOR SELECT USING (
    organization_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.user_profiles profile
      WHERE profile.auth_user_id = auth.uid()
        AND profile.owner_id = marketing_instagram_account_insights.organization_id
        AND profile.is_active = true
        AND (profile.role = 'admin' OR profile.permissions ? 'marketing')
    )
  );

DROP POLICY IF EXISTS marketing_instagram_account_insights_manage ON public.marketing_instagram_account_insights;
CREATE POLICY marketing_instagram_account_insights_manage ON public.marketing_instagram_account_insights
  FOR ALL USING (
    organization_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.user_profiles profile
      WHERE profile.auth_user_id = auth.uid()
        AND profile.owner_id = marketing_instagram_account_insights.organization_id
        AND profile.is_active = true AND profile.role = 'admin'
    )
  ) WITH CHECK (
    organization_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.user_profiles profile
      WHERE profile.auth_user_id = auth.uid()
        AND profile.owner_id = marketing_instagram_account_insights.organization_id
        AND profile.is_active = true AND profile.role = 'admin'
    )
  );
