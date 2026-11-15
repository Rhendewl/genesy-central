-- Service-only queue. All dashboard access is authorized by the Marketing server context.
CREATE TABLE public.marketing_instagram_scheduled_posts (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  connection_id uuid NOT NULL REFERENCES public.marketing_instagram_connections(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  scheduled_at timestamptz NOT NULL,
  caption text NOT NULL DEFAULT '',
  alt_texts jsonb NOT NULL DEFAULT '[]',
  paths text[] NOT NULL CHECK (cardinality(paths) BETWEEN 1 AND 10),
  children text[] NOT NULL DEFAULT '{}',
  container_id text,
  media_id text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','publishing','published','failed','cancelled')),
  locked_until timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketing_instagram_scheduled_posts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketing_instagram_scheduled_posts FROM anon, authenticated;
GRANT ALL ON public.marketing_instagram_scheduled_posts TO service_role;
CREATE INDEX instagram_posts_due ON public.marketing_instagram_scheduled_posts(scheduled_at, next_attempt_at)
  WHERE status IN ('scheduled','publishing');
CREATE OR REPLACE FUNCTION public.claim_instagram_scheduled_post()
RETURNS SETOF public.marketing_instagram_scheduled_posts
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE marketing_instagram_scheduled_posts SET locked_until = now() + interval '10 minutes', status = 'publishing'
  WHERE id = (
    SELECT id FROM marketing_instagram_scheduled_posts
    WHERE status IN ('scheduled','publishing') AND scheduled_at <= now() AND next_attempt_at <= now()
      AND (locked_until IS NULL OR locked_until < now())
    ORDER BY scheduled_at FOR UPDATE SKIP LOCKED LIMIT 1
  ) RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.claim_instagram_scheduled_post() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_instagram_scheduled_post() TO service_role;
