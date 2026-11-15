-- Extend the existing, service-only publication queue. Existing feed jobs stay compatible.
ALTER TABLE public.marketing_instagram_scheduled_posts
  ADD COLUMN IF NOT EXISTS media_kind text NOT NULL DEFAULT 'feed' CHECK (media_kind IN ('feed','reel','story')),
  ADD COLUMN IF NOT EXISTS asset_types text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preview_path text;

-- Existing RLS, grants, leases and the once-per-minute worker remain unchanged.
