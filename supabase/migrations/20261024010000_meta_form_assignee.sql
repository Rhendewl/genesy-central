BEGIN;
ALTER TABLE public.meta_form_subscriptions
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;
CREATE OR REPLACE FUNCTION public.validate_meta_form_assignee() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.id = NEW.assigned_to
      AND p.owner_id = NEW.user_id AND p.is_active AND p.auth_user_id IS NOT NULL
  ) THEN RAISE EXCEPTION 'Responsável indisponível nesta conta'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS validate_meta_form_assignee ON public.meta_form_subscriptions;
CREATE TRIGGER validate_meta_form_assignee BEFORE INSERT OR UPDATE OF assigned_to, user_id
ON public.meta_form_subscriptions FOR EACH ROW EXECUTE FUNCTION public.validate_meta_form_assignee();
COMMIT;
