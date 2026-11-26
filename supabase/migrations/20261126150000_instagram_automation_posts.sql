-- Comment automations can be limited to specific posts (empty list = all posts).
ALTER TABLE public.marketing_instagram_automations
  ADD COLUMN IF NOT EXISTS media_ids text[] NOT NULL DEFAULT '{}';
