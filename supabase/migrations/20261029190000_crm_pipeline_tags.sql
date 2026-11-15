BEGIN;
CREATE TABLE public.crm_pipeline_tags (
  pipeline_id uuid NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT public.effective_owner_id() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 60),
  color text NOT NULL DEFAULT '#4a8fd4',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pipeline_id, id),
  UNIQUE (pipeline_id, name)
);
ALTER TABLE public.crm_pipeline_tags ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_pipeline_tags TO authenticated;
GRANT ALL ON public.crm_pipeline_tags TO service_role;
CREATE POLICY crm_pipeline_tags_access ON public.crm_pipeline_tags FOR ALL TO authenticated
  USING (user_id = public.effective_owner_id() AND public.can_access_crm_pipeline(pipeline_id))
  WITH CHECK (user_id = public.effective_owner_id() AND public.can_access_crm_pipeline(pipeline_id)
    AND EXISTS (SELECT 1 FROM public.crm_pipelines p WHERE p.id = pipeline_id AND p.user_id = public.effective_owner_id()));

-- Independent copies retain legacy tag IDs, so lead assignments and tag-based
-- workflow triggers keep working without rewriting any lead or automation.
INSERT INTO public.crm_pipeline_tags (pipeline_id, id, user_id, name, color, created_at)
SELECT DISTINCT l.pipeline_id, t.id, p.user_id, t.name, t.color, t.created_at
FROM public.leads l
JOIN public.crm_pipelines p ON p.id = l.pipeline_id AND p.user_id = l.user_id
JOIN LATERAL jsonb_array_elements_text(coalesce(to_jsonb(l.tags), '[]'::jsonb)) used(tag_id) ON true
JOIN public.tags t ON t.id::text = used.tag_id AND t.user_id = p.user_id
ON CONFLICT DO NOTHING;
INSERT INTO public.crm_pipeline_tags (pipeline_id, id, user_id, name, color, created_at)
SELECT DISTINCT a.pipeline_id, t.id, p.user_id, t.name, t.color, t.created_at
FROM public.workflow_automations a
JOIN public.crm_pipelines p ON p.id = a.pipeline_id
JOIN public.tags t ON t.id::text = a.trigger_config->>'tagId' AND t.user_id = p.user_id
ON CONFLICT DO NOTHING;

-- A copied lead does not inherit labels from another pipeline's catalog.
-- jsonb_populate_record supports the existing array representation of leads.tags.
CREATE FUNCTION public.enforce_crm_pipeline_tags() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE allowed jsonb;
BEGIN
  IF NEW.pipeline_id IS NULL THEN RETURN NEW; END IF;
  SELECT coalesce(jsonb_agg(entry.value ORDER BY entry.ordinality), '[]'::jsonb) INTO allowed
  FROM jsonb_array_elements_text(coalesce(to_jsonb(NEW.tags), '[]'::jsonb)) WITH ORDINALITY entry(value, ordinality)
  WHERE EXISTS (SELECT 1 FROM public.crm_pipeline_tags t
    WHERE t.pipeline_id = NEW.pipeline_id AND t.user_id = NEW.user_id AND t.id::text = entry.value);
  NEW := jsonb_populate_record(NEW, jsonb_build_object('tags', allowed));
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_crm_pipeline_tags() FROM PUBLIC;
CREATE TRIGGER enforce_crm_pipeline_tags BEFORE INSERT OR UPDATE OF tags, pipeline_id ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.enforce_crm_pipeline_tags();
COMMIT;
