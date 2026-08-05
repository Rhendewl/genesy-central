-- Instagram organic reporting for the Marketing module.
-- Tokens are encrypted by the application before they reach this table.

CREATE TABLE IF NOT EXISTS public.marketing_instagram_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  connected_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instagram_user_id text NOT NULL,
  username text NOT NULL,
  display_name text,
  profile_picture_url text,
  followers_count integer NOT NULL DEFAULT 0,
  media_count integer NOT NULL DEFAULT 0,
  encrypted_access_token text NOT NULL,
  token_expires_at timestamptz,
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'error', 'disconnected')),
  last_sync_at timestamptz,
  sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, instagram_user_id)
);

CREATE TABLE IF NOT EXISTS public.marketing_instagram_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  connection_id uuid NOT NULL REFERENCES public.marketing_instagram_connections(id) ON DELETE CASCADE,
  marketing_content_id uuid REFERENCES public.marketing_contents(id) ON DELETE SET NULL,
  instagram_media_id text NOT NULL,
  media_type text NOT NULL,
  media_product_type text,
  caption text,
  media_url text,
  thumbnail_url text,
  permalink text,
  published_at timestamptz NOT NULL,
  reach bigint NOT NULL DEFAULT 0,
  views bigint NOT NULL DEFAULT 0,
  plays bigint NOT NULL DEFAULT 0,
  likes bigint NOT NULL DEFAULT 0,
  comments bigint NOT NULL DEFAULT 0,
  saved bigint NOT NULL DEFAULT 0,
  shares bigint NOT NULL DEFAULT 0,
  total_interactions bigint NOT NULL DEFAULT 0,
  average_watch_time numeric NOT NULL DEFAULT 0,
  total_watch_time numeric NOT NULL DEFAULT 0,
  raw_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, instagram_media_id)
);

CREATE INDEX IF NOT EXISTS marketing_instagram_connections_org_idx
  ON public.marketing_instagram_connections (organization_id, status);
CREATE INDEX IF NOT EXISTS marketing_instagram_media_org_date_idx
  ON public.marketing_instagram_media (organization_id, published_at DESC);
CREATE INDEX IF NOT EXISTS marketing_instagram_media_connection_idx
  ON public.marketing_instagram_media (connection_id, published_at DESC);
CREATE INDEX IF NOT EXISTS marketing_instagram_media_content_idx
  ON public.marketing_instagram_media (marketing_content_id)
  WHERE marketing_content_id IS NOT NULL;

ALTER TABLE public.marketing_instagram_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_instagram_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_instagram_connections_select ON public.marketing_instagram_connections;
CREATE POLICY marketing_instagram_connections_select ON public.marketing_instagram_connections
  FOR SELECT USING (
    organization_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_profiles profile
      WHERE profile.auth_user_id = auth.uid()
        AND profile.owner_id = marketing_instagram_connections.organization_id
        AND profile.is_active = true
        AND (profile.role = 'admin' OR profile.permissions ? 'marketing')
    )
  );

DROP POLICY IF EXISTS marketing_instagram_connections_manage ON public.marketing_instagram_connections;
CREATE POLICY marketing_instagram_connections_manage ON public.marketing_instagram_connections
  FOR ALL USING (
    organization_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_profiles profile
      WHERE profile.auth_user_id = auth.uid()
        AND profile.owner_id = marketing_instagram_connections.organization_id
        AND profile.is_active = true
        AND profile.role = 'admin'
    )
  )
  WITH CHECK (
    organization_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_profiles profile
      WHERE profile.auth_user_id = auth.uid()
        AND profile.owner_id = marketing_instagram_connections.organization_id
        AND profile.is_active = true
        AND profile.role = 'admin'
    )
  );

DROP POLICY IF EXISTS marketing_instagram_media_select ON public.marketing_instagram_media;
CREATE POLICY marketing_instagram_media_select ON public.marketing_instagram_media
  FOR SELECT USING (
    organization_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_profiles profile
      WHERE profile.auth_user_id = auth.uid()
        AND profile.owner_id = marketing_instagram_media.organization_id
        AND profile.is_active = true
        AND (profile.role = 'admin' OR profile.permissions ? 'marketing')
    )
  );

DROP POLICY IF EXISTS marketing_instagram_media_manage ON public.marketing_instagram_media;
CREATE POLICY marketing_instagram_media_manage ON public.marketing_instagram_media
  FOR ALL USING (
    organization_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_profiles profile
      WHERE profile.auth_user_id = auth.uid()
        AND profile.owner_id = marketing_instagram_media.organization_id
        AND profile.is_active = true
        AND profile.role = 'admin'
    )
  )
  WITH CHECK (
    organization_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_profiles profile
      WHERE profile.auth_user_id = auth.uid()
        AND profile.owner_id = marketing_instagram_media.organization_id
        AND profile.is_active = true
        AND profile.role = 'admin'
    )
  );
