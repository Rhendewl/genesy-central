-- Public forms are resolved exclusively by /form/:slug, without user_id.
-- The database constraint mirrors that public namespace and closes the race
-- between simultaneous create/duplicate requests.

DROP INDEX IF EXISTS public.forms_user_slug_idx;

CREATE UNIQUE INDEX IF NOT EXISTS forms_public_slug_unique_idx
  ON public.forms (slug)
  WHERE deleted_at IS NULL;
